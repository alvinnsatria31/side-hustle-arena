import "server-only";
import { getDb } from "@/server/db/client";
import { ArenaDomainError } from "@/server/arena/errors";
import { claimReviewJob, completeReviewJob, type CompletedReview } from "./queue-service";
import { StubReviewProvider } from "./model-router";

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
