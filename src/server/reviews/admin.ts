import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { reviewJobs, reviewOverrides, reviews, submissionVersions, submissions, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "./audit";
import { canAdminRequeue } from "./queue-policy";

type Db = ReturnType<typeof getDb>;

/**
 * Admin review operations (PRD §31).
 *
 * Launch rule: no user-facing appeal. Admin/Product Owner gets Rerun and
 * Manual Override. Both never consume a user review attempt, are audited with
 * before/after state + reason + actor, and never delete the original review.
 */

// Rankings and points are copied once at finalization. Lock the week before any review row, in finalize's order.
async function assertWeekStillCorrectable(tx: Pick<Db, "select">, submissionVersionId: string, action: "override" | "rerun") {
  const [owner] = await tx.select({ weekId: submissions.weekId }).from(submissionVersions)
    .innerJoin(submissions, eq(submissions.id, submissionVersions.submissionId))
    .where(eq(submissionVersions.id, submissionVersionId));
  if (!owner) throw new ArenaDomainError("SUBMISSION_NOT_FOUND", "Submission version not found.");
  const [week] = await tx.select({ status: weeks.status }).from(weeks).where(eq(weeks.id, owner.weekId)).for("share");
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Week not found.");
  if (week.status === "FINALIZED" || week.status === "ARCHIVED") {
    throw new ArenaDomainError("WEEK_ALREADY_FINALIZED", `Cannot ${action} review after week has been finalized. Final results and points are frozen.`);
  }
}

/**
 * Requeue a version for a fresh review run. The old review rows stay untouched.
 *
 * This is also the recovery path for a review that never produced a row at
 * all — a first attempt whose extraction or provider failed terminally. It
 * previously refused those ("only a reviewed version can be rerun"), which left
 * an operator with no button and a week that would not finalize; the only fix
 * was hand-written SQL. A version with no review is now rerunnable, and what is
 * refused instead is stealing a job from a worker that still holds a live lease.
 */
export async function rerunReview(
  input: { versionId: string; actorSubject: string; reason: string; now?: Date; db?: Db },
): Promise<{ jobId: string; nextRunNumber: number }> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  if (!input.actorSubject.trim() || !input.reason.trim()) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Rerun requires an actor and a reason.");
  }
  return db.transaction(async (tx) => {
  await assertWeekStillCorrectable(tx, input.versionId, "rerun");
  const version = (
    await tx.select().from(submissionVersions).where(eq(submissionVersions.id, input.versionId))
  )[0];
  if (!version) throw new ArenaDomainError("SUBMISSION_NOT_FOUND", "Submission version not found.");
  if (version.reviewAttemptNumber == null || version.accessStatus !== "ACCESSIBLE") {
    throw new ArenaDomainError("VALIDATION_ERROR", "Only a version that consumed a review attempt can be rerun.");
  }
  const existing = await tx
    .select({ runNumber: reviews.runNumber, aiScore: reviews.aiScore })
    .from(reviews)
    .where(eq(reviews.submissionVersionId, input.versionId))
    .orderBy(desc(reviews.runNumber))
    .limit(1);
  const nextRunNumber = (existing[0]?.runNumber ?? 0) + 1;

  const job = (await tx.select().from(reviewJobs).where(eq(reviewJobs.submissionVersionId, input.versionId)).for("update"))[0];
  if (!canAdminRequeue(job ?? null, now)) {
    throw new ArenaDomainError("REVIEW_JOB_UNAVAILABLE", "A worker still holds a live lease on this review; wait for it to finish or expire.");
  }
  let jobId = job?.id;
  if (job) {
    await tx
      .update(reviewJobs)
      .set({ status: "PENDING", attemptCount: 0, lockedAt: null, lockedBy: null, leaseExpiresAt: null, availableAt: now, lastErrorCode: null, lastErrorMessage: null, updatedAt: now })
      .where(eq(reviewJobs.id, job.id));
  } else {
    const [created] = await tx
      .insert(reviewJobs)
      .values({ submissionVersionId: input.versionId, status: "PENDING", availableAt: now })
      .returning({ id: reviewJobs.id });
    jobId = created.id;
  }
  await tx
    .update(submissionVersions)
    .set({ reviewStatus: "QUEUED" })
    .where(eq(submissionVersions.id, input.versionId));
  await writeAudit(tx, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "REVIEW_RERUN",
    entityType: "review_job",
    entityId: jobId,
    metadata: {
      versionId: input.versionId,
      nextRunNumber,
      previousAiScore: existing[0]?.aiScore ?? null,
      recovery: existing.length === 0 ? "first-review-failure" : null,
      previousJobStatus: job?.status ?? null,
      reason: input.reason,
    },
  });
  return { jobId: jobId!, nextRunNumber };
  });
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
  return db.transaction(async (tx) => {
  const [target] = await tx.select({ versionId: reviews.submissionVersionId }).from(reviews).where(eq(reviews.id, input.reviewId));
  if (!target) throw new ArenaDomainError("SUBMISSION_NOT_FOUND", "Review not found.");
  await assertWeekStillCorrectable(tx, target.versionId, "override");
  const review = (await tx.select().from(reviews).where(eq(reviews.id, input.reviewId)).for("update"))[0];
  if (!review) throw new ArenaDomainError("SUBMISSION_NOT_FOUND", "Review not found.");
  const previousScore = review.finalScore == null ? null : Number(review.finalScore);
  await tx.insert(reviewOverrides).values({
    reviewId: review.id,
    adminSubject: input.actorSubject,
    previousScore: previousScore?.toFixed(2) ?? null,
    newScore: input.newScore.toFixed(2),
    reason: input.reason,
  });
  await tx
    .update(reviews)
    .set({ finalScore: input.newScore.toFixed(2), status: review.status === "NEEDS_RESOLUTION" ? "COMPLETED_HIDDEN" : review.status, updatedAt: input.now ?? new Date() })
    .where(eq(reviews.id, review.id));
  await writeAudit(tx, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "REVIEW_OVERRIDE",
    entityType: "review",
    entityId: review.id,
    metadata: { previousScore, newScore: input.newScore, reason: input.reason },
  });
  return { reviewId: review.id, previousScore, newScore: input.newScore };
  });
}
