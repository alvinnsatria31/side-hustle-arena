import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { reviewJobs, reviewOverrides, reviews, submissionVersions } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "./audit";

type Db = ReturnType<typeof getDb>;

/**
 * Admin review operations (PRD §31).
 *
 * Launch rule: no user-facing appeal. Admin/Product Owner gets Rerun and
 * Manual Override. Both never consume a user review attempt, are audited with
 * before/after state + reason + actor, and never delete the original review.
 */

/** Requeue a version for a fresh review run. The old review rows stay untouched. */
export async function rerunReview(
  input: { versionId: string; actorSubject: string; reason: string; now?: Date; db?: Db },
): Promise<{ jobId: string; nextRunNumber: number }> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  if (!input.actorSubject.trim() || !input.reason.trim()) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Rerun requires an actor and a reason.");
  }
  const version = (
    await db.select().from(submissionVersions).where(eq(submissionVersions.id, input.versionId))
  )[0];
  if (!version) throw new ArenaDomainError("SUBMISSION_NOT_FOUND", "Submission version not found.");
  const existing = await db
    .select({ runNumber: reviews.runNumber, aiScore: reviews.aiScore })
    .from(reviews)
    .where(eq(reviews.submissionVersionId, input.versionId))
    .orderBy(desc(reviews.runNumber))
    .limit(1);
  if (existing.length === 0) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Only a reviewed version can be rerun.");
  }
  const nextRunNumber = existing[0].runNumber + 1;

  const job = (await db.select().from(reviewJobs).where(eq(reviewJobs.submissionVersionId, input.versionId)))[0];
  let jobId = job?.id;
  if (job) {
    await db
      .update(reviewJobs)
      .set({ status: "PENDING", attemptCount: 0, lockedAt: null, lockedBy: null, leaseExpiresAt: null, availableAt: now, lastErrorCode: null, lastErrorMessage: null, updatedAt: now })
      .where(eq(reviewJobs.id, job.id));
  } else {
    const [created] = await db
      .insert(reviewJobs)
      .values({ submissionVersionId: input.versionId, status: "PENDING", availableAt: now })
      .returning({ id: reviewJobs.id });
    jobId = created.id;
  }
  await db
    .update(submissionVersions)
    .set({ reviewStatus: "QUEUED" })
    .where(eq(submissionVersions.id, input.versionId));
  await writeAudit(db, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "REVIEW_RERUN",
    entityType: "review_job",
    entityId: jobId,
    metadata: { versionId: input.versionId, nextRunNumber, previousAiScore: existing[0].aiScore, reason: input.reason },
  });
  return { jobId: jobId!, nextRunNumber };
}

/** Manual score override. The review row keeps its AI score; finalScore moves; history is appended. */
export async function overrideReview(
  input: { reviewId: string; actorSubject: string; newScore: number; reason: string; now?: Date; db?: Db },
): Promise<{ reviewId: string; previousScore: number | null; newScore: number }> {
  const db = input.db ?? getDb();
  if (!input.actorSubject.trim() || !input.reason.trim()) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Override requires an actor and a reason.");
  }
  if (!Number.isFinite(input.newScore) || input.newScore < 0 || input.newScore > 100) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Override score must be between 0 and 100.");
  }
  const review = (await db.select().from(reviews).where(eq(reviews.id, input.reviewId)))[0];
  if (!review) throw new ArenaDomainError("SUBMISSION_NOT_FOUND", "Review not found.");
  const previousScore = review.finalScore == null ? null : Number(review.finalScore);
  await db.insert(reviewOverrides).values({
    reviewId: review.id,
    adminSubject: input.actorSubject,
    previousScore: previousScore?.toFixed(2) ?? null,
    newScore: input.newScore.toFixed(2),
    reason: input.reason,
  });
  await db
    .update(reviews)
    .set({ finalScore: input.newScore.toFixed(2), updatedAt: input.now ?? new Date() })
    .where(eq(reviews.id, review.id));
  await writeAudit(db, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "REVIEW_OVERRIDE",
    entityType: "review",
    entityId: review.id,
    metadata: { previousScore, newScore: input.newScore, reason: input.reason },
  });
  return { reviewId: review.id, previousScore, newScore: input.newScore };
}
