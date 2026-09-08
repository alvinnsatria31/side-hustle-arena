import "server-only";
import { and, desc, eq, inArray, not, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  enrollments,
  pointAccounts,
  pointLedger,
  projectRubricCriteria,
  projectSkills,
  projects,
  reviewJobs,
  reviewScores,
  reviews,
  skillEvidence,
  submissionVersions,
  submissions,
  weeklyRankings,
  weeks,
} from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { notify } from "@/server/notifications/service";
import { crossedThresholds, getLifetimePoints } from "@/server/rewards/milestones";
import { catalog } from "@/server/db/schema";
import { writeAudit } from "@/server/reviews/audit";
import { rankFinalists } from "./ranking";
import { eligibleVersionOrder, isFinalizableReview } from "./finalist-core";
import { attributeSkillEvidence } from "./skill-attribution";

type Db = ReturnType<typeof getDb>;

async function findWeek(db: Db, input: { weekId?: string; weekCode?: string }) {
  const rows = input.weekId
    ? await db.select().from(weeks).where(eq(weeks.id, input.weekId))
    : await db.select().from(weeks).where(eq(weeks.weekCode, input.weekCode!));
  const week = rows[0];
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Arena week not found.");
  return week;
}

/**
 * Move a week into FINALIZING after the Friday 23:59 WIB deadline.
 * Normal path requires `now >= submissionDeadlineAt`; `force` covers the
 * admin emergency close/extend (PRD §49) and is audited as such.
 * Idempotent: an already-FINALIZING week returns its state.
 */
export async function closeWeekForFinalization(input: {
  weekId?: string;
  weekCode?: string;
  actorSubject: string;
  force?: boolean;
  now?: Date;
  db?: Db;
}): Promise<{ weekId: string; status: string }> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  const week = await findWeek(db, input);
  if (week.status === "FINALIZING") return { weekId: week.id, status: week.status };
  if (week.status === "FINALIZED" || week.status === "ARCHIVED") {
    throw new ArenaDomainError("WEEK_CLOSED", "Week is already finalized.");
  }
  if (!input.force && now < week.submissionDeadlineAt) {
    throw new ArenaDomainError("WEEK_NOT_READY", "The submission deadline has not passed yet.");
  }
  // Guarded write: a concurrent finalize/admin action that moved the week to
  // FINALIZING/FINALIZED/ARCHIVED after our pre-check must not be regressed.
  const closed = await db
    .update(weeks)
    .set({ status: "FINALIZING", closedAt: week.closedAt ?? now, updatedAt: now })
    .where(and(eq(weeks.id, week.id), not(inArray(weeks.status, ["FINALIZING", "FINALIZED", "ARCHIVED"]))))
    .returning({ id: weeks.id });
  if (!closed[0]) {
    throw new ArenaDomainError("WEEK_CLOSED", "Week moved to a closed state concurrently.");
  }
  await writeAudit(db, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: input.force ? "WEEK_FORCE_CLOSED" : "WEEK_CLOSED",
    entityType: "week",
    entityId: week.id,
    metadata: { weekCode: week.weekCode, forced: input.force ?? false },
  });
  return { weekId: week.id, status: "FINALIZING" };
}

interface EligibleFinalist {
  userId: string;
  enrollmentId: string;
  projectId: string;
  versionId: string;
  reviewId: string;
  finalScore: number;
  finalSubmittedAt: Date;
}

async function collectEligibleFinalists(db: Db, weekId: string): Promise<EligibleFinalist[]> {
  const weekEnrollments = await db.select().from(enrollments).where(eq(enrollments.weekId, weekId));
  const finalists: EligibleFinalist[] = [];
  for (const enrollment of weekEnrollments) {
    if (enrollment.status === "VOIDED") continue;
    const submission = (
      await db.select().from(submissions).where(eq(submissions.enrollmentId, enrollment.id))
    )[0];
    if (!submission || submission.status === "VOIDED") continue;
    const versions = await db
      .select()
      .from(submissionVersions)
      .where(eq(submissionVersions.submissionId, submission.id))
      .orderBy(desc(submissionVersions.versionNumber));
    // Newest-first, but "newest that actually has a score". A later attempt
    // whose review failed terminally must fall back to the earlier reviewed
    // version rather than erase a valid completion (PRD §33/§62).
    for (const version of eligibleVersionOrder(versions)) {
      const runs = await db
        .select()
        .from(reviews)
        .where(eq(reviews.submissionVersionId, version.id))
        .orderBy(desc(reviews.runNumber))
        .limit(1);
      const review = runs[0];
      if (!isFinalizableReview(review)) continue;
      finalists.push({
        userId: enrollment.userId,
        enrollmentId: enrollment.id,
        projectId: enrollment.projectId,
        versionId: version.id,
        reviewId: review.id,
        finalScore: Number(review.finalScore),
        finalSubmittedAt: version.submittedAt,
      });
      break;
    }
  }
  return finalists;
}

/**
 * Friday finalization (PRD §62): resolve final versions, rank globally,
 * award points idempotently, publish results.
 *
 * Preconditions (fail-closed): week is FINALIZING, no open review jobs, no
 * unresolved NEEDS_RESOLUTION reviews. Resolve those first (rerun/override),
 * then finalize. Re-running a FINALIZED week is safe: rankings upsert, ledger
 * inserts are idempotent, accounts only move on new ledger rows.
 */
export async function finalizeWeek(input: {
  weekId: string;
  actorSubject: string;
  now?: Date;
  db?: Db;
}): Promise<{ weekId: string; ranked: number; pointsAwarded: number }> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  return db.transaction(async (tx) => finalizeWeekInTransaction({ ...input, now, db: tx }));
}

async function finalizeWeekInTransaction(input: {
  weekId: string; actorSubject: string; now: Date; db: Db;
}): Promise<{ weekId: string; ranked: number; pointsAwarded: number }> {
  const { db, now } = input;
  await db.select({ id: weeks.id }).from(weeks).where(eq(weeks.id, input.weekId)).for("update");
  const week = await findWeek(db, { weekId: input.weekId });
  if (week.status === "FINALIZED") {
    const existing = await db.select().from(weeklyRankings).where(eq(weeklyRankings.weekId, week.id));
    const total = existing.reduce((sum, row) => sum + row.pointsAwarded, 0);
    return { weekId: week.id, ranked: existing.length, pointsAwarded: total };
  }
  if (week.status !== "FINALIZING") {
    throw new ArenaDomainError("WEEK_NOT_READY", "Week must be closed for finalization first.");
  }

  const openJobs = await db
    .select({ id: reviewJobs.id })
    .from(reviewJobs)
    .innerJoin(submissionVersions, eq(reviewJobs.submissionVersionId, submissionVersions.id))
    .innerJoin(submissions, eq(submissionVersions.submissionId, submissions.id))
    .where(and(eq(submissions.weekId, week.id), inArray(reviewJobs.status, ["PENDING", "PROCESSING", "RETRY"])));
  const weekReviews = await db
    .select({ id: reviews.id, versionId: reviews.submissionVersionId, status: reviews.status })
    .from(reviews)
    .innerJoin(submissionVersions, eq(reviews.submissionVersionId, submissionVersions.id))
    .innerJoin(submissions, eq(submissionVersions.submissionId, submissions.id))
    .where(eq(submissions.weekId, week.id))
    .orderBy(desc(reviews.runNumber));
  const latestRuns = new Map<string, typeof weekReviews[number]>();
  for (const review of weekReviews) if (!latestRuns.has(review.versionId)) latestRuns.set(review.versionId, review);
  const unresolved = [...latestRuns.values()].filter((review) => review.status === "NEEDS_RESOLUTION");
  if (openJobs.length > 0 || unresolved.length > 0) {
    throw new ArenaDomainError("WEEK_NOT_READY", "Pending reviews or unresolved disagreements must be resolved first.", {
      openJobs: openJobs.length,
      needsResolution: unresolved.length,
    });
  }

  const ranked = rankFinalists(await collectEligibleFinalists(db, week.id));
  // Canonical slugs for inbox deep links (stable across weeks, unlike UUIDs in
  // the address bar — matches the history links in the participant dashboard).
  const slugByProject = new Map<string, string>();
  if (ranked.length > 0) {
    const slugRows = await db
      .select({ id: projects.id, slug: projects.slug })
      .from(projects)
      .where(inArray(projects.id, [...new Set(ranked.map((finalist) => finalist.projectId))]));
    for (const row of slugRows) slugByProject.set(row.id, row.slug);
  }
  let pointsAwarded = 0;
  for (const finalist of ranked) {
    await db
      .insert(weeklyRankings)
      .values({
        weekId: week.id,
        userId: finalist.userId,
        projectId: finalist.projectId,
        submissionVersionId: finalist.versionId,
        reviewId: finalist.reviewId,
        finalScore: finalist.finalScore.toFixed(2),
        finalSubmittedAt: finalist.finalSubmittedAt,
        rank: finalist.rank,
        pointsAwarded: finalist.points,
      })
      .onConflictDoUpdate({
        target: [weeklyRankings.weekId, weeklyRankings.userId],
        set: {
          projectId: finalist.projectId,
          submissionVersionId: finalist.versionId,
          reviewId: finalist.reviewId,
          finalScore: finalist.finalScore.toFixed(2),
          finalSubmittedAt: finalist.finalSubmittedAt,
          rank: finalist.rank,
          pointsAwarded: finalist.points,
        },
      });
    const ledgerRows = await db
      .insert(pointLedger)
      .values({
        userId: finalist.userId,
        amount: finalist.points,
        entryType: "WEEKLY_RANK",
        weekId: week.id,
        referenceType: "weekly_ranking",
        referenceId: finalist.versionId,
        description: `Week ${week.weekCode} rank #${finalist.rank}`,
        idempotencyKey: `finalize:${week.id}:${finalist.userId}`,
      })
      .onConflictDoNothing({ target: pointLedger.idempotencyKey })
      .returning({ id: pointLedger.id });
    if (ledgerRows.length > 0) {
      pointsAwarded += finalist.points;
      await db
        .insert(pointAccounts)
        .values({ userId: finalist.userId, balance: finalist.points, lifetimeEarned: finalist.points, lifetimeSpent: 0 })
        .onConflictDoUpdate({
          target: pointAccounts.userId,
          set: {
            balance: sql`${pointAccounts.balance} + ${finalist.points}`,
            lifetimeEarned: sql`${pointAccounts.lifetimeEarned} + ${finalist.points}`,
          },
        });
    }
    await db
      .update(enrollments)
      .set({ status: "COMPLETED", completedAt: now })
      .where(eq(enrollments.id, finalist.enrollmentId));
    // Skill evidence: one row per project skill, traceable to the review row.
    // Unique (review, skill) + on-conflict-ignore keeps idempotent re-finalize
    // safe; the participant reader only serves evidence whose ranking survived
    // (voids delete the ranking row).
    //
    // The SCORE is per skill, not the project score copied across. Criteria a
    // curator attributed to a skill are what measure it; where nothing is
    // attributed the project score stands in and the row says so, so no reader
    // can mistake one measurement for several.
    const [reviewRow] = await db
      .select({ summary: reviews.summary })
      .from(reviews)
      .where(eq(reviews.id, finalist.reviewId));
    const skillRows = await db
      .select({ skillId: projectSkills.skillId })
      .from(projectSkills)
      .where(eq(projectSkills.projectId, finalist.projectId));
    if (skillRows.length > 0) {
      const criteria = await db
        .select({ id: projectRubricCriteria.id, skillId: projectRubricCriteria.skillId, weight: projectRubricCriteria.weight, maxScore: projectRubricCriteria.maxScore })
        .from(projectRubricCriteria)
        .where(eq(projectRubricCriteria.projectId, finalist.projectId));
      const criterionScores = await db
        .select({ rubricCriterionId: reviewScores.rubricCriterionId, rawScore: reviewScores.rawScore, maxScore: reviewScores.maxScore })
        .from(reviewScores)
        .where(eq(reviewScores.reviewId, finalist.reviewId));
      const attributed = attributeSkillEvidence({
        projectSkills: skillRows.map((skill) => skill.skillId),
        criteria: criteria.map((criterion) => ({
          id: criterion.id, skillId: criterion.skillId,
          weight: Number(criterion.weight), maxScore: Number(criterion.maxScore),
        })),
        scores: criterionScores.map((score) => ({
          rubricCriterionId: score.rubricCriterionId,
          rawScore: Number(score.rawScore), maxScore: Number(score.maxScore),
        })),
        projectScore: finalist.finalScore,
      });
      await db
        .insert(skillEvidence)
        .values(
          attributed.map((skill) => ({
            userId: finalist.userId,
            weekId: week.id,
            projectId: finalist.projectId,
            reviewId: finalist.reviewId,
            skillId: skill.skillId,
            score: skill.score.toFixed(2),
            attribution: skill.attribution,
            criterionCount: skill.criterionCount,
            evidenceSummary: reviewRow?.summary ?? null,
          })),
        )
        .onConflictDoNothing({ target: [skillEvidence.reviewId, skillEvidence.skillId] });
    }
    // Best-effort inbox notices (PRD §36). Gated on a fresh award so an
    // idempotent re-finalize never double-notifies.
    if (ledgerRows.length > 0) {
      const previousLifetime = (await getLifetimePoints(finalist.userId, db)) - finalist.points;
      await notify({
        type: "RESULT_READY",
        userId: finalist.userId,
        weekId: week.id,
        title: `Hasil minggu ini: peringkat #${finalist.rank}`,
        body: `Skor akhirmu ${finalist.finalScore.toFixed(0)}/100. Lihat papan peringkat buat detailnya.`,
        actionUrl: `/app/arena/result/${slugByProject.get(finalist.projectId) ?? finalist.projectId}`,
      }, db);
      await notify({
        type: "POINTS_AWARDED",
        userId: finalist.userId,
        weekId: week.id,
        title: `+${finalist.points} poin masuk`,
        body: `Peringkat #${finalist.rank} minggu ${week.weekCode}. Poin nggak kedaluwarsa — kumpulin buat ditukar reward.`,
        actionUrl: "/app/profile",
      }, db);
      // Milestone nudge: newly-crossed catalog thresholds only.
      const activeCosts = (
        await db.select({ pointsCost: catalog.pointsCost }).from(catalog).where(eq(catalog.isActive, true))
      ).map((row) => row.pointsCost);
      const crossed = crossedThresholds(previousLifetime, finalist.points, activeCosts);
      for (const threshold of crossed) {
        await notify({
          type: "MILESTONE_REACHED",
          userId: finalist.userId,
          weekId: week.id,
          title: `Hadiah ${threshold} poin kebuka!`,
          body: `Total poinmu ${previousLifetime + finalist.points} — ada reward nunggu diambil di katalog.`,
          actionUrl: "/app/profile",
        }, db);
      }
    }
  }

  await db
    .update(weeks)
    .set({ status: "FINALIZED", finalizedAt: now, updatedAt: now })
    .where(eq(weeks.id, week.id));
  await writeAudit(db, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "WEEK_FINALIZED",
    entityType: "week",
    entityId: week.id,
    metadata: { weekCode: week.weekCode, ranked: ranked.length, pointsAwarded },
  });
  return { weekId: week.id, ranked: ranked.length, pointsAwarded };
}

/**
 * Fraud/plagiarism void (PRD §32). Scoring and fraud stay separate: the
 * review score row is preserved, but eligibility dies. Pre-finalize, the
 * enrollment is simply excluded. Post-finalize, awarded points are revoked
 * via a negative ADMIN_REVERSAL ledger entry and the ranking row is removed.
 */
export async function voidEnrollment(input: {
  enrollmentId: string;
  actorSubject: string;
  reason: string;
  now?: Date;
  db?: Db;
}): Promise<{ enrollmentId: string; pointsRevoked: number }> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  if (!input.actorSubject.trim() || !input.reason.trim()) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Void requires an actor and a reason.");
  }
  const enrollment = (await db.select().from(enrollments).where(eq(enrollments.id, input.enrollmentId)))[0];
  if (!enrollment) throw new ArenaDomainError("ENROLLMENT_NOT_FOUND", "Enrollment not found.");
  const week = (await db.select().from(weeks).where(eq(weeks.id, enrollment.weekId)))[0];
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Arena week not found.");

  // One transaction: a crash between the ledger insert and the account update
  // must not leave the balance behind the ledger (same atomicity rule as
  // finalizeWeek — the ledger/account pair always moves together).
  return db.transaction(async (tx) => {
  await tx.update(enrollments).set({ status: "VOIDED", updatedAt: now }).where(eq(enrollments.id, enrollment.id));
  await tx
    .update(submissions)
    .set({ status: "VOIDED", updatedAt: now })
    .where(eq(submissions.enrollmentId, enrollment.id));

  let pointsRevoked = 0;
  const ranking = (
    await tx
      .select()
      .from(weeklyRankings)
      .where(and(eq(weeklyRankings.weekId, week.id), eq(weeklyRankings.userId, enrollment.userId)))
  )[0];
  if (ranking && ranking.pointsAwarded > 0) {
    const reversal = await tx
      .insert(pointLedger)
      .values({
        userId: enrollment.userId,
        amount: -ranking.pointsAwarded,
        entryType: "ADMIN_REVERSAL",
        weekId: week.id,
        referenceType: "fraud_void",
        referenceId: enrollment.id,
        description: `Void enrollment ${enrollment.id}: ${input.reason}`.slice(0, 280),
        idempotencyKey: `void:${enrollment.id}`,
      })
      .onConflictDoNothing({ target: pointLedger.idempotencyKey })
      .returning({ id: pointLedger.id });
    if (reversal.length > 0) {
      pointsRevoked = ranking.pointsAwarded;
      await tx
        .insert(pointAccounts)
        .values({ userId: enrollment.userId, balance: 0, lifetimeEarned: 0, lifetimeSpent: pointsRevoked })
        .onConflictDoUpdate({
          target: pointAccounts.userId,
          set: {
            balance: sql`greatest(0, ${pointAccounts.balance} - ${pointsRevoked})`,
            lifetimeSpent: sql`${pointAccounts.lifetimeSpent} + ${pointsRevoked}`,
          },
        });
    }
    await tx.delete(weeklyRankings).where(eq(weeklyRankings.id, ranking.id));
  }
  // Skill evidence is only served through a surviving ranking row, but remove
  // the rows outright so a voided enrollment leaves zero residue.
  await tx
    .delete(skillEvidence)
    .where(
      and(
        eq(skillEvidence.userId, enrollment.userId),
        eq(skillEvidence.weekId, week.id),
        eq(skillEvidence.projectId, enrollment.projectId),
      ),
    );

  await writeAudit(tx, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "FRAUD_VOID",
    entityType: "enrollment",
    entityId: enrollment.id,
    metadata: { reason: input.reason, pointsRevoked, weekFinalized: week.status === "FINALIZED" },
  });
  return { enrollmentId: enrollment.id, pointsRevoked };
  });
}
