import "server-only";
import { getDb } from "@/server/db/client";
import { ArenaDomainError } from "@/server/arena/errors";
import { claimReviewJob, completeReviewJob, failReviewJob, type CompletedReview } from "./queue-service";
import { createReviewProvider, StubReviewProvider } from "./model-router";
import { EXECUTION_CONTRACT, createExecutionBudget, isDeadlineError, reviewJobBudgetMs } from "@/server/ops/execution-budget";

/**
 * Local development worker: claims one job and completes it with the
 * deterministic stub reviewer. Hermes/VPS path uses the internal HTTP routes
 * instead (claim → model call on the worker → complete). Both converge on
 * completeReviewJob, so validation/scoring/judge logic is identical.
 *
 * Refuses to run outside APP_ENV=development: stub scores must never reach a
 * production review row.
 */
export async function runOneReviewJob(input: {
  workerId?: string;
  stubConfidence?: number;
  stubScoreShift?: number;
  now?: Date;
} = {}): Promise<CompletedReview | null> {
  if ((process.env.APP_ENV ?? "") !== "development") {
    throw new ArenaDomainError("REVIEW_PROVIDER_FAILED", "The local stub worker runs in development only.");
  }
  const workerId = input.workerId ?? "local-dev-worker";
  const now = input.now ?? new Date();
  const db = getDb();
  const claimed = await claimReviewJob(workerId, now, db);
  if (!claimed) return null;
  const stub = new StubReviewProvider({ confidence: input.stubConfidence, scoreShift: input.stubScoreShift });
  const primary = await stub.review({ profile: "review", model: stub.name, input: claimed.input });
  return completeReviewJob({
    jobId: claimed.jobId,
    workerId,
    output: primary,
    judgeProvider: new StubReviewProvider({ confidence: 0.82 }),
    now,
    db,
  });
}

/**
 * Claim and complete one queued review.
 *
 * `budgetMs` is the caller's remaining time, not a per-call timeout: the same
 * signal bounds the primary review AND the second judge together, because from
 * the drain tick's point of view those are one unit of work. Without it a job
 * could run its provider ceiling twice over (120s primary + 120s judge, on top
 * of a 60s extraction) inside an invocation that is killed at 60s.
 *
 * An expired budget surfaces as a provider failure, which hands the job back
 * for retry without consuming a participant attempt (PRD §42) — the same path
 * a real provider timeout already took.
 */
export async function runConfiguredReviewJob(options: { budgetMs?: number } = {}): Promise<CompletedReview | null> {
  const provider = createReviewProvider('review');
  const budget = createExecutionBudget(options.budgetMs ?? EXECUTION_CONTRACT.drainBudgetMs);
  // Do not claim what cannot be finished. A claim that is abandoned when the
  // invocation dies still spends one of the five automation attempts and holds
  // a lease for ten minutes; declining is strictly better than starting.
  if (!budget.hasRoomFor(reviewJobBudgetMs())) return null;
  const workerId = `arena-worker:${crypto.randomUUID()}`;
  // The budget starts BEFORE the claim, because the claim is where extraction
  // and OCR happen. Starting the clock afterwards was the original bug: a 45s
  // budget that had already spent a minute before its first tick.
  const claimed = await claimReviewJob(workerId, new Date(), undefined, undefined, { budget });
  if (!claimed) return null;
  try {
    const primary = await provider.review({
      profile: 'review',
      model: process.env.AI_REVIEW_MODEL ?? provider.name,
      input: claimed.input,
      signal: budget.signal(EXECUTION_CONTRACT.modelBudgetMs),
    });
    return await completeReviewJob({ jobId: claimed.jobId, workerId, output: primary, model: process.env.AI_REVIEW_MODEL ?? provider.name, budget });
  } catch (error) {
    if (!(error instanceof ArenaDomainError) || error.code === 'REVIEW_PROVIDER_FAILED') {
      await failReviewJob({
        jobId: claimed.jobId,
        workerId,
        code: isDeadlineError(error) ? 'REVIEW_BUDGET_EXCEEDED' : 'REVIEW_PROVIDER_FAILED',
        message: isDeadlineError(error)
          ? 'Review ran out of execution budget; retry scheduled.'
          : 'Configured review provider failed; retry scheduled.',
      });
    }
    throw error;
  }
}
