import "server-only";
import { and, asc, desc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  enrollments,
  projectRubricCriteria,
  projects,
  divisions,
  reviewJobs,
  reviews,
  reviewScores,
  submissionVersionItems,
  submissionVersions,
  submissions,
} from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { createPresignedDownload } from "@/server/storage";
import { buildBlindReviewerInput, buildImprovementFeedback, type BlindRubricCriterion } from "./reviewer-input";
import { validateReviewerOutput } from "./validator";
import { computeWeightedScore, secondJudgeDisagrees } from "./scorer";
import { needsSecondJudge, REVIEW_CONFIDENCE_MIN } from "./judge-router";
import { PROMPT_VERSION, StubReviewProvider, type ReviewProvider } from "./model-router";
import { reviewerOutputSchema, type ReviewerOutput } from "./review-schema";
import { writeAudit } from "./audit";

type Db = ReturnType<typeof getDb>;

/** Automation retry budget per job (PRD §42, §47). Separate from user review attempts. */
export const MAX_JOB_ATTEMPTS = 5;
/** Worker lease duration: covers model call + file fetch with margin. */
export const JOB_LEASE_SECONDS = 600;

function backoffAvailableAt(attemptCount: number, now: Date): Date {
  const backoffSeconds = Math.min(3600, attemptCount * attemptCount * 60);
  return new Date(now.getTime() + backoffSeconds * 1000);
}

/** Idempotent enqueue: one PENDING job per accessible version, version marked QUEUED. */
export async function enqueueReviewJob(tx: Db, versionId: string, now: Date = new Date()): Promise<void> {
  await tx
    .insert(reviewJobs)
    .values({ submissionVersionId: versionId, status: "PENDING", availableAt: now })
    .onConflictDoNothing({ target: reviewJobs.submissionVersionId });
  await tx
    .update(submissionVersions)
    .set({ reviewStatus: "QUEUED" })
    .where(and(eq(submissionVersions.id, versionId), eq(submissionVersions.reviewStatus, "NOT_QUEUED")));
  await writeAudit(tx, {
    actorType: "SYSTEM",
    action: "REVIEW_ENQUEUED",
    entityType: "review_job",
    entityId: versionId,
  });
}

export interface ClaimedJob {
  jobId: string;
  versionId: string;
  attemptNumber: number | null;
  leaseExpiresAt: Date;
  input: ReturnType<typeof buildBlindReviewerInput>;
}

/**
 * Atomic lease: exactly one worker wins each job. Picks the oldest available
 * PENDING job, or an expired-lease PROCESSING/RETRY job (crashed worker
 * recovery), bounded by the automation attempt budget.
 */
export async function claimReviewJob(
  workerId: string,
  now: Date = new Date(),
  db: Db = getDb(),
): Promise<ClaimedJob | null> {
  const leaseExpiresAt = new Date(now.getTime() + JOB_LEASE_SECONDS * 1000);
  // SELECT FOR UPDATE SKIP LOCKED + UPDATE in one transaction: exactly one
  // worker wins each job, including crashed-worker recovery via expired lease.
  const claimed = await db.transaction(async (tx) => {
    const candidate = (
      await tx
        .select({ id: reviewJobs.id, submissionVersionId: reviewJobs.submissionVersionId })
        .from(reviewJobs)
        .where(
          and(
            or(
              and(eq(reviewJobs.status, "PENDING"), lte(reviewJobs.availableAt, now)),
              and(inArray(reviewJobs.status, ["PROCESSING", "RETRY"]), lte(reviewJobs.leaseExpiresAt, now)),
            ),
            lt(reviewJobs.attemptCount, MAX_JOB_ATTEMPTS),
          ),
        )
        .orderBy(desc(reviewJobs.priority), asc(reviewJobs.availableAt))
        .limit(1)
        .for("update", { skipLocked: true })
    )[0];
    if (!candidate) return null;
    const [updated] = await tx
      .update(reviewJobs)
      .set({
        status: "PROCESSING",
        lockedBy: workerId,
        lockedAt: now,
        leaseExpiresAt,
        attemptCount: sql`${reviewJobs.attemptCount} + 1`,
        updatedAt: now,
      })
      .where(eq(reviewJobs.id, candidate.id))
      .returning({ id: reviewJobs.id, submissionVersionId: reviewJobs.submissionVersionId });
    return updated ?? null;
  });
  if (!claimed) return null;

  const input = await buildJobInput(db, claimed.submissionVersionId);
  await writeAudit(db, {
    actorType: "AUTOMATION",
    actorSubject: workerId,
    action: "REVIEW_CLAIMED",
    entityType: "review_job",
    entityId: claimed.id,
  });
  return {
    jobId: claimed.id,
    versionId: claimed.submissionVersionId,
    attemptNumber: input.attemptNumber,
    leaseExpiresAt,
    input: input.blind,
  };
}

async function loadVersionContext(db: Db, versionId: string) {
  const version = (
    await db.select().from(submissionVersions).where(eq(submissionVersions.id, versionId))
  )[0];
  if (!version) throw new ArenaDomainError("SUBMISSION_NOT_FOUND", "Submission version not found.");
  const items = await db
    .select()
    .from(submissionVersionItems)
    .where(eq(submissionVersionItems.submissionVersionId, versionId));
  const submission = (
    await db.select().from(submissions).where(eq(submissions.id, version.submissionId))
  )[0];
  if (!submission) throw new ArenaDomainError("SUBMISSION_NOT_FOUND", "Submission not found.");
  const enrollment = (
    await db.select().from(enrollments).where(eq(enrollments.id, submission.enrollmentId))
  )[0];
  if (!enrollment) throw new ArenaDomainError("ENROLLMENT_NOT_FOUND", "Enrollment not found.");
  const projectRow = (
    await db
      .select({ project: projects, division: divisions })
      .from(projects)
      .innerJoin(divisions, eq(projects.divisionId, divisions.id))
      .where(eq(projects.id, enrollment.projectId))
  )[0];
  if (!projectRow) throw new ArenaDomainError("PROJECT_NOT_FOUND", "Project not found.");
  const rubric = await db
    .select()
    .from(projectRubricCriteria)
    .where(eq(projectRubricCriteria.projectId, projectRow.project.id))
    .orderBy(asc(projectRubricCriteria.sortOrder));
  return { version, items, project: projectRow.project, division: projectRow.division, rubric };
}

async function buildJobInput(db: Db, versionId: string) {
  const { version, items, project, division, rubric } = await loadVersionContext(db, versionId);
  const blindRubric: BlindRubricCriterion[] = rubric.map((criterion) => ({
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    weight: Number(criterion.weight),
    maxScore: Number(criterion.maxScore),
    reviewInstruction: criterion.reviewInstruction,
  }));
  const blindItems = await Promise.all(
    items.map(async (item) => {
      let downloadUrl: string | null = null;
      if (item.itemType === "FILE" && item.storageKey) {
        try {
          downloadUrl = await createPresignedDownload(item.storageKey);
        } catch {
          downloadUrl = null;
        }
      }
      return {
        itemType: item.itemType,
        label: item.label,
        externalUrl: item.externalUrl,
        originalFilename: item.originalFilename,
        mimeType: item.mimeType,
        fileSizeBytes: item.fileSizeBytes,
        downloadUrl,
      };
    }),
  );
  return {
    attemptNumber: version.reviewAttemptNumber,
    blind: buildBlindReviewerInput({
      attemptNumber: version.reviewAttemptNumber ?? 0,
      projectTitle: project.title,
      divisionName: division.name,
      rubric: blindRubric,
      explanation: version.explanation,
      notes: version.notes,
      items: blindItems,
    }),
  };
}

function getJudgeProvider(): ReviewProvider {
  // Dev/test only until a real provider key is provisioned (see .env.example AI_*).
  if ((process.env.APP_ENV ?? "") !== "development") {
    throw new ArenaDomainError("REVIEW_PROVIDER_FAILED", "No review provider is configured for this environment.");
  }
  return new StubReviewProvider({ confidence: 0.82 });
}

export interface CompletedReview {
  reviewId: string;
  versionId: string;
  runNumber: number;
  aiScore: number;
  finalScore: number;
  status: string;
  secondJudge: { ran: boolean; reason: string | null; disagrees: boolean };
}

/**
 * Persist a worker-delivered primary review. The server validates, optionally
 * runs the independent second judge, computes the weighted score, and
 * persists — the worker never writes scores directly (PRD §20).
 */
export async function completeReviewJob(input: {
  jobId: string;
  workerId: string;
  output: unknown;
  judgeProvider?: ReviewProvider;
  now?: Date;
  db?: Db;
}): Promise<CompletedReview> {
  const { jobId, workerId, judgeProvider = getJudgeProvider() } = input;
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();

  const job = (await db.select().from(reviewJobs).where(eq(reviewJobs.id, jobId)))[0];
  if (!job) throw new ArenaDomainError("REVIEW_JOB_NOT_FOUND", "Review job not found.");
  if (job.lockedBy !== workerId || !job.leaseExpiresAt || job.leaseExpiresAt <= now || job.status === "COMPLETED" || job.status === "FAILED") {
    throw new ArenaDomainError("REVIEW_JOB_UNAVAILABLE", "Review job is not leased to this worker.");
  }

  const { version, items, rubric } = await loadVersionContext(db, job.submissionVersionId);
  if (rubric.length === 0) {
    await handleInvalidOutput(db, job, workerId, ["project has no rubric criteria"], now);
    throw new ArenaDomainError("REVIEW_VALIDATION_FAILED", "Project has no rubric criteria.");
  }
  const blindRubric: BlindRubricCriterion[] = rubric.map((criterion) => ({
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    weight: Number(criterion.weight),
    maxScore: Number(criterion.maxScore),
    reviewInstruction: criterion.reviewInstruction,
  }));
  const validation = validateReviewerOutput(input.output, blindRubric);
  if (!validation.ok) {
    await handleInvalidOutput(db, job, workerId, validation.errors, now);
    throw new ArenaDomainError("REVIEW_VALIDATION_FAILED", `Review output failed validation: ${validation.errors[0]}`, {
      errors: validation.errors,
    });
  }
  const primary = validation.output;
  const { aiScore, rows } = computeWeightedScore(primary.criteria, blindRubric);

  // Second-judge routing (PRD §27): independent blind re-review, server-side.
  const hasUnextractedFiles = items.some((item) => item.itemType === "FILE");
  const routing = needsSecondJudge({
    confidence: primary.confidence,
    warningCount: validation.warnings.length,
    hasUnextractedFiles,
  });
  let judgeScore: number | null = null;
  let disagrees = false;
  if (routing.needed) {
    const judgeInput = await buildJobInput(db, job.submissionVersionId);
    const judgeOutput = await judgeProvider.review({
      profile: "judge",
      model: judgeProvider.name,
      input: judgeInput.blind,
    });
    const judgeValidation = validateReviewerOutput(judgeOutput, blindRubric);
    if (judgeValidation.ok) {
      judgeScore = computeWeightedScore(judgeValidation.output.criteria, blindRubric).aiScore;
      disagrees = secondJudgeDisagrees(aiScore, judgeScore);
    }
  }

  const status = disagrees ? "NEEDS_RESOLUTION" : "COMPLETED_HIDDEN";
  const existingRuns = await db
    .select({ runNumber: reviews.runNumber })
    .from(reviews)
    .where(eq(reviews.submissionVersionId, job.submissionVersionId))
    .orderBy(desc(reviews.runNumber))
    .limit(1);
  const runNumber = (existingRuns[0]?.runNumber ?? 0) + 1;

  // Post-lock improvement feedback (PRD §28, §29): previous attempt comparison
  // only, never fed back into scoring.
  let summary = primary.strengths.length
    ? `Strengths: ${primary.strengths.join(" ")}`
    : "Review completed.";
  if (version.reviewAttemptNumber && version.reviewAttemptNumber > 1) {
    const previousAttempt = await findPreviousAttemptReview(db, job.submissionVersionId, version.reviewAttemptNumber);
    if (previousAttempt) {
      const feedback = buildImprovementFeedback({
        current: primary.criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          criterionName: blindRubric.find((r) => r.id === criterion.criterionId)?.name ?? criterion.criterionId,
          score: criterion.score,
        })),
        previous: previousAttempt,
      });
      const parts = [];
      if (feedback.improved.length) parts.push(`Improved: ${feedback.improved.join("; ")}.`);
      if (feedback.stillNeedsWork.length) parts.push(`Still needs work: ${feedback.stillNeedsWork.join("; ")}.`);
      if (parts.length) summary = `${summary} ${parts.join(" ")}`;
    }
  }

  const [review] = await db
    .insert(reviews)
    .values({
      submissionVersionId: job.submissionVersionId,
      runNumber,
      status: status as "COMPLETED_HIDDEN" | "NEEDS_RESOLUTION",
      aiScore: aiScore.toFixed(2),
      finalScore: aiScore.toFixed(2),
      summary,
      strengths: primary.strengths,
      improvements: primary.priorityImprovements,
      reviewConfidence: primary.confidence.toFixed(4),
      reviewModel: workerId === "local-dev-worker" ? "stub-dev-v1" : "external-worker",
      promptVersion: PROMPT_VERSION,
      reviewedAt: now,
    })
    .returning();
  await db.insert(reviewScores).values(
    rows.map((row) => ({
      reviewId: review.id,
      rubricCriterionId: row.rubricCriterionId,
      rawScore: row.rawScore.toFixed(2),
      maxScore: row.maxScore.toFixed(2),
      weightedScore: row.weightedScore.toFixed(2),
      feedback: primary.criteria.find((criterion) => criterion.criterionId === row.rubricCriterionId)?.issues.join(" ") ?? null,
    })),
  );
  await db
    .update(submissionVersions)
    .set({ reviewStatus: "COMPLETED" })
    .where(eq(submissionVersions.id, job.submissionVersionId));
  await db
    .update(reviewJobs)
    .set({ status: "COMPLETED", lastErrorCode: null, lastErrorMessage: null, updatedAt: now })
    .where(eq(reviewJobs.id, jobId));
  await writeAudit(db, {
    actorType: "AUTOMATION",
    actorSubject: workerId,
    action: disagrees ? "REVIEW_NEEDS_RESOLUTION" : "REVIEW_COMPLETED",
    entityType: "review",
    entityId: review.id,
    metadata: {
      versionId: job.submissionVersionId,
      runNumber,
      aiScore,
      confidence: primary.confidence,
      judgeRan: routing.needed,
      judgeReason: routing.reason,
      judgeScore,
      disagrees,
    },
  });
  return {
    reviewId: review.id,
    versionId: job.submissionVersionId,
    runNumber,
    aiScore,
    finalScore: aiScore,
    status,
    secondJudge: { ran: routing.needed, reason: routing.reason, disagrees },
  };
}

async function findPreviousAttemptReview(
  db: Db,
  versionId: string,
  attemptNumber: number,
): Promise<Array<{ criterionId: string; criterionName: string; score: number }> | null> {
  // Previous VALID attempt = latest completed review on an earlier version of
  // the same submission with a non-null review attempt number.
  const version = (await db.select().from(submissionVersions).where(eq(submissionVersions.id, versionId)))[0];
  if (!version) return null;
  const siblings = await db
    .select()
    .from(submissionVersions)
    .where(eq(submissionVersions.submissionId, version.submissionId))
    .orderBy(desc(submissionVersions.versionNumber));
  for (const sibling of siblings) {
    if (sibling.id === versionId) continue;
    if (sibling.reviewAttemptNumber == null || sibling.reviewAttemptNumber >= attemptNumber) continue;
    if (sibling.reviewStatus !== "COMPLETED") continue;
    const siblingReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.submissionVersionId, sibling.id))
      .orderBy(desc(reviews.runNumber))
      .limit(1);
    const latest = siblingReviews[0];
    if (!latest || latest.status === "VOIDED" || latest.status === "FAILED") continue;
    const scores = await db.select().from(reviewScores).where(eq(reviewScores.reviewId, latest.id));
    if (!scores.length) continue;
    const criteria = await db.select().from(projectRubricCriteria);
    const names = new Map(criteria.map((criterion) => [criterion.id, criterion.name]));
    return scores.map((score) => ({
      criterionId: score.rubricCriterionId,
      criterionName: names.get(score.rubricCriterionId) ?? score.rubricCriterionId,
      score: Number(score.rawScore),
    }));
  }
  return null;
}

async function handleInvalidOutput(db: Db, job: typeof reviewJobs.$inferSelect, workerId: string, errors: string[], now: Date): Promise<void> {
  if (job.attemptCount >= MAX_JOB_ATTEMPTS) {
    await db
      .update(reviewJobs)
      .set({ status: "FAILED", lastErrorCode: "REVIEW_VALIDATION_FAILED", lastErrorMessage: errors[0]?.slice(0, 500) ?? null, updatedAt: now })
      .where(eq(reviewJobs.id, job.id));
    await db
      .update(submissionVersions)
      .set({ reviewStatus: "FAILED" })
      .where(eq(submissionVersions.id, job.submissionVersionId));
    await writeAudit(db, {
      actorType: "AUTOMATION",
      actorSubject: workerId,
      action: "REVIEW_FAILED",
      entityType: "review_job",
      entityId: job.id,
      metadata: { reason: "validation-exhausted", errors: errors.slice(0, 5) },
    });
    return;
  }
  await db
    .update(reviewJobs)
    .set({ status: "RETRY", availableAt: backoffAvailableAt(job.attemptCount, now), lastErrorCode: "REVIEW_VALIDATION_FAILED", lastErrorMessage: errors[0]?.slice(0, 500) ?? null, updatedAt: now })
    .where(eq(reviewJobs.id, job.id));
  await writeAudit(db, {
    actorType: "AUTOMATION",
    actorSubject: workerId,
    action: "REVIEW_RETRY",
    entityType: "review_job",
    entityId: job.id,
    metadata: { reason: "validation", errors: errors.slice(0, 5) },
  });
}

/** Worker-reported failure (model timeout, fetch error, …). Never consumes a user attempt (PRD §42). */
export async function failReviewJob(input: {
  jobId: string;
  workerId: string;
  code: string;
  message: string;
  now?: Date;
  db?: Db;
}): Promise<{ status: string }> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  const job = (await db.select().from(reviewJobs).where(eq(reviewJobs.id, input.jobId)))[0];
  if (!job) throw new ArenaDomainError("REVIEW_JOB_NOT_FOUND", "Review job not found.");
  if (job.lockedBy !== input.workerId) throw new ArenaDomainError("REVIEW_JOB_UNAVAILABLE", "Review job is not leased to this worker.");
  if (job.attemptCount >= MAX_JOB_ATTEMPTS) {
    await db
      .update(reviewJobs)
      .set({ status: "FAILED", lastErrorCode: input.code.slice(0, 100), lastErrorMessage: input.message.slice(0, 500), updatedAt: now })
      .where(eq(reviewJobs.id, job.id));
    await db
      .update(submissionVersions)
      .set({ reviewStatus: "FAILED" })
      .where(eq(submissionVersions.id, job.submissionVersionId));
    await writeAudit(db, {
      actorType: "AUTOMATION",
      actorSubject: input.workerId,
      action: "REVIEW_FAILED",
      entityType: "review_job",
      entityId: job.id,
      metadata: { code: input.code, attemptCount: job.attemptCount },
    });
    return { status: "FAILED" };
  }
  await db
    .update(reviewJobs)
    .set({ status: "RETRY", availableAt: backoffAvailableAt(job.attemptCount, now), lastErrorCode: input.code.slice(0, 100), lastErrorMessage: input.message.slice(0, 500), updatedAt: now })
    .where(eq(reviewJobs.id, job.id));
  await writeAudit(db, {
    actorType: "AUTOMATION",
    actorSubject: input.workerId,
    action: "REVIEW_RETRY",
    entityType: "review_job",
    entityId: job.id,
    metadata: { code: input.code },
  });
  return { status: "RETRY" };
}

export async function getReviewQueueDepth(db: Db = getDb()): Promise<Record<string, number>> {
  const rows = (await db.execute(sql`
    select status, count(*)::int as count from arena.review_jobs group by status
  `)) as unknown as Array<{ status: string; count: number }>;
  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}

export { REVIEW_CONFIDENCE_MIN };
export type { ReviewerOutput };
export { reviewerOutputSchema };
