import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { reviewJobs } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { claimReviewJob, completeReviewJob, failReviewJob } from "@/server/reviews/queue-service";
import type { ReviewerOutput } from "@/server/reviews/review-schema";
import { writeAudit } from "@/server/reviews/audit";

type Db = ReturnType<typeof getDb>;

/**
 * External grading ingest (n8n/VPS grading engine → app) — the counterpart of
 * the website's `/api/webhooks/arena-eval` route, adapted to the job queue.
 *
 * The external grader works a version through the SAME lease pipeline as any
 * worker: this call finds its PENDING job, leases it to the external worker,
 * validates + scores server-side, and persists. No PENDING job (already
 * completed, or a duplicate delivery) returns `{ deduped: true }` — a retry
 * can never double-score, with no extra idempotency column needed.
 */
export async function ingestExternalReview(input: {
  versionId: string;
  workerLabel: string;
  output: ReviewerOutput;
  model?: string;
  now?: Date;
  db?: Db;
}): Promise<{ reviewId: string; runNumber: number; aiScore: number; status: string; deduped: boolean }> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  const pending = (
    await db.select({ id: reviewJobs.id }).from(reviewJobs)
      .where(eq(reviewJobs.submissionVersionId, input.versionId))
  )[0];
  if (!pending) return { reviewId: "", runNumber: 0, aiScore: 0, status: "COMPLETED", deduped: true };
  const job = (await db.select().from(reviewJobs).where(eq(reviewJobs.id, pending.id)))[0];
  if (!job || job.status === "COMPLETED") {
    return { reviewId: "", runNumber: 0, aiScore: 0, status: job?.status ?? "UNKNOWN", deduped: true };
  }
  const workerId = `external-eval:${input.workerLabel}`.slice(0, 100);
  const claimed = await claimReviewJob(workerId, now, db, job.id);
  if (!claimed || claimed.jobId !== job.id) {
    // Lost the race to another worker — its completion wins; this delivery
    // is a safe no-op rather than a second opinion.
    throw new ArenaDomainError("REVIEW_JOB_UNAVAILABLE", "Review job is not available; retry delivery later.");
  }
  try {
    const completed = await completeReviewJob({ jobId: job.id, workerId, output: input.output, model: input.model, db });
    await writeAudit(db, {
      actorType: "AUTOMATION",
      actorSubject: workerId,
      action: "EVAL_INGESTED",
      entityType: "review",
      entityId: completed.reviewId,
      metadata: { versionId: input.versionId, model: input.model ?? "external", aiScore: completed.aiScore },
    });
    return { ...completed, deduped: false };
  } catch (error) {
    if (!(error instanceof ArenaDomainError) || error.code === 'REVIEW_PROVIDER_FAILED') {
      await failReviewJob({ jobId: job.id, workerId, code: 'REVIEW_PROVIDER_FAILED', message: 'External review failed; retry delivery.', db });
    }
    if (error instanceof ArenaDomainError) throw error;
    throw new ArenaDomainError("REVIEW_PROVIDER_FAILED", "External review ingest failed.");
  }
}
