import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
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
import { PROMPT_VERSION, createReviewProvider, isApiReviewProvider, type ReviewProvider } from "./model-router";
import { reviewerOutputSchema, type ReviewerOutput } from "./review-schema";
import { writeAudit } from "./audit";
import { ensureReviewSources } from "./artifacts";
import { JOB_LEASE_SECONDS, MAX_JOB_ATTEMPTS, backoffAvailableAt, classifyLease } from "./queue-policy";
import { EXECUTION_CONTRACT, type ExecutionBudget } from "@/server/ops/execution-budget";

type Db = ReturnType<typeof getDb>;

export { JOB_LEASE_SECONDS, MAX_JOB_ATTEMPTS };

/**
 * End jobs that can never be claimed again.
 *
 * `claimReviewJob` refuses anything at or above the attempt budget, so a
 * worker that dies after winning the last attempt strands its job in
 * PROCESSING with a dead lease. Nothing retries it, and `finalizeWeek` counts
 * it as an open job and blocks the whole week. This turns that state into a
 * terminal FAILED, which an operator can recover with an audited rerun.
 *
 * One conditional UPDATE, so concurrent sweepers cannot double-report and a
 * job that was legitimately re-leased in between is left alone.
 */
export async function sweepAbandonedReviewJobs(now: Date = new Date(), db: Db = getDb()): Promise<{ failed: string[] }> {
  const stranded = await db
    .update(reviewJobs)
    .set({
      status: "FAILED",
      lastErrorCode: "LEASE_ABANDONED",
      lastErrorMessage: "Worker lease expired on the final automation attempt; job requires an admin rerun.",
      updatedAt: now,
    })
    .where(and(
      eq(reviewJobs.status, "PROCESSING"),
      gte(reviewJobs.attemptCount, MAX_JOB_ATTEMPTS),
      lte(reviewJobs.leaseExpiresAt, now),
    ))
    .returning({ id: reviewJobs.id, versionId: reviewJobs.submissionVersionId });
  for (const job of stranded) {
    await db
      .update(submissionVersions)
      .set({ reviewStatus: "FAILED" })
      .where(eq(submissionVersions.id, job.versionId));
    await writeAudit(db, {
      actorType: "SYSTEM",
      action: "REVIEW_FAILED",
      entityType: "review_job",
      entityId: job.id,
      metadata: { reason: "lease-abandoned-at-attempt-limit", attemptCount: MAX_JOB_ATTEMPTS },
    });
  }
  return { failed: stranded.map((job) => job.id) };
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
  targetJobId?: string,
  options: { budget?: ExecutionBudget } = {},
): Promise<ClaimedJob | null> {
  const leaseExpiresAt = new Date(now.getTime() + JOB_LEASE_SECONDS * 1000);
  // Self-healing: retire jobs stranded past the attempt budget before looking
  // for work, so a crashed final attempt cannot hold a week open forever.
  await sweepAbandonedReviewJobs(now, db);
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
              and(inArray(reviewJobs.status, ["PENDING", "RETRY"]), lte(reviewJobs.availableAt, now)),
              and(eq(reviewJobs.status, "PROCESSING"), lte(reviewJobs.leaseExpiresAt, now)),
            ),
            targetJobId ? eq(reviewJobs.id, targetJobId) : undefined,
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

  let input: Awaited<ReturnType<typeof buildJobInput>>;
  try {
    input = await buildJobInput(db, claimed.submissionVersionId, options);
  } catch {
    await failReviewJob({ jobId: claimed.id, workerId, code: 'ARTIFACT_EXTRACTION_FAILED', message: 'Artifact could not be extracted. Retry or inspect the submission.', now, db });
    throw new ArenaDomainError('REVIEW_PROVIDER_FAILED', 'Submission artifact extraction failed.');
  }
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

async function buildJobInput(db: Db, versionId: string, options: { budget?: ExecutionBudget } = {}) {
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
  // Same provider question as the factory, so it has to read the same way: a
  // development box pointed at a real provider extracts evidence, a stubbed one
  // does not. Spelling one provider name here and two there is how the second
  // judge came to be misconfigured in the first place.
  const sources = process.env.APP_ENV !== 'development' || isApiReviewProvider()
    ? await ensureReviewSources(db, version, items, options) : undefined;
  return {
    attemptNumber: version.reviewAttemptNumber,
    blind: { ...buildBlindReviewerInput({
      attemptNumber: version.reviewAttemptNumber ?? 0,
      projectTitle: project.title,
      divisionName: division.name,
      // The assignment itself. Blind to previous judgements, not to the task.
      brief: {
        caseBackground: project.caseBackground,
        roleDescription: project.roleDescription,
        mission: project.mission,
        objective: project.objective,
      },
      rubric: blindRubric,
      explanation: version.explanation,
      notes: version.notes,
      items: blindItems,
    }), sources },
  };
}

function getJudgeProvider(): ReviewProvider {
  try {
    return createReviewProvider('judge');
  } catch {
    throw new ArenaDomainError("REVIEW_PROVIDER_FAILED", "No review provider is configured for this environment.");
  }
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
  model?: string;
  now?: Date;
  db?: Db;
  /** The caller's remaining time, forwarded to the second judge's model call. */
  signal?: AbortSignal;
  /**
   * The invocation's remaining budget. The second judge is a whole extra model
   * call, so starting one with no time left guarantees the invocation is killed
   * mid-write; with a budget we hand the job back for retry instead.
   */
  budget?: ExecutionBudget;
}): Promise<CompletedReview> {
  const { jobId, workerId } = input;
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();

  const job = (await db.select().from(reviewJobs).where(eq(reviewJobs.id, jobId)))[0];
  if (!job) throw new ArenaDomainError("REVIEW_JOB_NOT_FOUND", "Review job not found.");
  const lease = classifyLease(job, { workerId, now });
  if (lease !== "VALID") {
    throw new ArenaDomainError("REVIEW_JOB_UNAVAILABLE", `Review job is not leased to this worker (${lease}).`);
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
  const jobInput = await buildJobInput(db, job.submissionVersionId, { budget: input.budget });
  const validation = validateReviewerOutput(input.output, blindRubric, jobInput.blind.sources);
  if (!validation.ok) {
    await handleInvalidOutput(db, job, workerId, validation.errors, now);
    throw new ArenaDomainError("REVIEW_VALIDATION_FAILED", `Review output failed validation: ${validation.errors[0]}`, {
      errors: validation.errors,
    });
  }
  const primary = validation.output;
  const { aiScore, rows } = computeWeightedScore(primary.criteria, blindRubric);

  // Second-judge routing (PRD §27): independent blind re-review, server-side.
  const hasUnextractedFiles = items.some((item) => item.itemType === "FILE") && !jobInput.blind.sources;
  const routing = needsSecondJudge({
    confidence: primary.confidence,
    warningCount: validation.warnings.length,
    hasUnextractedFiles,
  });
  let judgeScore: number | null = null;
  let judgeEvidence: unknown = null;
  let disagrees = false;
  if (routing.needed) {
    // Refuse to start a second model call the invocation cannot survive. This
    // throws before any review row exists, so the job retries with a fresh
    // budget and the participant loses nothing (PRD §42).
    input.budget?.assertRoomFor(EXECUTION_CONTRACT.modelBudgetMs, "second judge", EXECUTION_CONTRACT.persistenceReserveMs);
    const judgeProvider = input.judgeProvider ?? getJudgeProvider();
    const judgeOutput = await judgeProvider.review({
      profile: "judge",
      model: judgeProvider.name,
      input: jobInput.blind,
      signal: input.signal ?? input.budget?.signal(EXECUTION_CONTRACT.modelBudgetMs),
    });
    const judgeValidation = validateReviewerOutput(judgeOutput, blindRubric, jobInput.blind.sources);
    if (!judgeValidation.ok) {
      await handleInvalidOutput(db, job, workerId, judgeValidation.errors, now);
      throw new ArenaDomainError("REVIEW_VALIDATION_FAILED", "Second judge output failed validation.");
    }
    if (judgeValidation.ok) {
      judgeEvidence = judgeValidation.output;
      judgeScore = computeWeightedScore(judgeValidation.output.criteria, blindRubric).aiScore;
      disagrees = secondJudgeDisagrees(aiScore, judgeScore);
    }
  }

  const status = disagrees ? "NEEDS_RESOLUTION" : "COMPLETED_HIDDEN";

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

  return db.transaction(async (tx) => {
  // Recheck the lease under lock after the model call; expired workers cannot
  // publish over a newer claimant or create duplicate review runs.
  const lockedJob = (await tx.select().from(reviewJobs).where(eq(reviewJobs.id, jobId)).for("update"))[0];
  if (!lockedJob || classifyLease(lockedJob, { workerId, now: input.now ?? new Date(), attemptCount: job.attemptCount }) !== "VALID") {
    throw new ArenaDomainError("REVIEW_JOB_UNAVAILABLE", "Review lease changed before completion.");
  }
  const existingRuns = await tx.select({ runNumber: reviews.runNumber }).from(reviews)
    .where(eq(reviews.submissionVersionId, job.submissionVersionId)).orderBy(desc(reviews.runNumber)).limit(1);
  const runNumber = (existingRuns[0]?.runNumber ?? 0) + 1;
  const [review] = await tx
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
      reviewModel: input.model ?? (workerId === "local-dev-worker" ? "stub-dev-v1" : "external-worker"),
      promptVersion: PROMPT_VERSION,
      reviewedAt: now,
    })
    .returning();
  await tx.insert(reviewScores).values(
    rows.map((row) => ({
      reviewId: review.id,
      rubricCriterionId: row.rubricCriterionId,
      rawScore: row.rawScore.toFixed(2),
      maxScore: row.maxScore.toFixed(2),
      weightedScore: row.weightedScore.toFixed(2),
      feedback: primary.criteria.find((criterion) => criterion.criterionId === row.rubricCriterionId)?.issues.join(" ") ?? null,
      evidence: primary.criteria.find((criterion) => criterion.criterionId === row.rubricCriterionId)?.evidence ?? [],
    })),
  );
  await tx
    .update(submissionVersions)
    .set({ reviewStatus: "COMPLETED" })
    .where(eq(submissionVersions.id, job.submissionVersionId));
  await tx
    .update(reviewJobs)
    .set({ status: "COMPLETED", lastErrorCode: null, lastErrorMessage: null, updatedAt: now })
    .where(eq(reviewJobs.id, jobId));
  await writeAudit(tx, {
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
      judgeEvidence,
      sourceHashes: jobInput.blind.sources?.map((source) => ({ id: source.id, sha256: source.sha256 })),
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
  });
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
  // Same conditional-write rule as failReviewJob: only the lease this call was
  // validated against may move the row.
  const leased = and(
    eq(reviewJobs.id, job.id),
    eq(reviewJobs.status, "PROCESSING"),
    eq(reviewJobs.lockedBy, workerId),
    eq(reviewJobs.attemptCount, job.attemptCount),
  );
  if (job.attemptCount >= MAX_JOB_ATTEMPTS) {
    await db
      .update(reviewJobs)
      .set({ status: "FAILED", lastErrorCode: "REVIEW_VALIDATION_FAILED", lastErrorMessage: errors[0]?.slice(0, 500) ?? null, updatedAt: now })
      .where(leased);
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
    .where(leased);
  await writeAudit(db, {
    actorType: "AUTOMATION",
    actorSubject: workerId,
    action: "REVIEW_RETRY",
    entityType: "review_job",
    entityId: job.id,
    metadata: { reason: "validation", errors: errors.slice(0, 5) },
  });
}

/**
 * Worker-reported failure (model timeout, fetch error, …). Never consumes a
 * user attempt (PRD §42).
 *
 * This used to check only `lockedBy`, which is not enough: `lockedBy` survives
 * completion, so a worker that timed out locally after its result had already
 * landed would report failure and flip a COMPLETED job back to RETRY —
 * re-reviewing work that already had a valid score. Failure now takes the same
 * lease under the same row lock that completion does, and a callback that
 * arrives too late is reported back as not-applied rather than obeyed.
 */
export async function failReviewJob(input: {
  jobId: string;
  workerId: string;
  code: string;
  message: string;
  now?: Date;
  db?: Db;
}): Promise<{ status: string; applied: boolean; reason?: string }> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  return db.transaction(async (tx) => {
    const job = (await tx.select().from(reviewJobs).where(eq(reviewJobs.id, input.jobId)).for("update"))[0];
    if (!job) throw new ArenaDomainError("REVIEW_JOB_NOT_FOUND", "Review job not found.");
    const lease = classifyLease(job, { workerId: input.workerId, now });
    if (lease !== "VALID") {
      // Not an error the worker can act on, and not something to retry: the
      // job moved on without it. Recorded so a stale worker is visible.
      await writeAudit(tx, {
        actorType: "AUTOMATION",
        actorSubject: input.workerId,
        action: "REVIEW_FAIL_IGNORED",
        entityType: "review_job",
        entityId: job.id,
        metadata: { code: input.code, reason: lease, jobStatus: job.status },
      });
      return { status: job.status, applied: false, reason: lease };
    }

    const terminal = job.attemptCount >= MAX_JOB_ATTEMPTS;
    const settled = (await tx
      .update(reviewJobs)
      .set({
        status: terminal ? "FAILED" : "RETRY",
        ...(terminal ? {} : { availableAt: backoffAvailableAt(job.attemptCount, now) }),
        lastErrorCode: input.code.slice(0, 100),
        lastErrorMessage: input.message.slice(0, 500),
        updatedAt: now,
      })
      // Conditional write, not a bare id match: another transaction may have
      // completed or re-leased this row between the read and here.
      .where(and(
        eq(reviewJobs.id, job.id),
        eq(reviewJobs.status, "PROCESSING"),
        eq(reviewJobs.lockedBy, input.workerId),
        eq(reviewJobs.attemptCount, job.attemptCount),
      ))
      .returning({ id: reviewJobs.id }))[0];
    if (!settled) return { status: job.status, applied: false, reason: "RACE_LOST" };

    if (terminal) {
      await tx
        .update(submissionVersions)
        .set({ reviewStatus: "FAILED" })
        .where(eq(submissionVersions.id, job.submissionVersionId));
    }
    await writeAudit(tx, {
      actorType: "AUTOMATION",
      actorSubject: input.workerId,
      action: terminal ? "REVIEW_FAILED" : "REVIEW_RETRY",
      entityType: "review_job",
      entityId: job.id,
      metadata: { code: input.code, attemptCount: job.attemptCount },
    });
    return { status: terminal ? "FAILED" : "RETRY", applied: true };
  });
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
