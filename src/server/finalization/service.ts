import "server-only";
import { and, desc, eq, inArray, not, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  enrollments,
  pointAccounts,
  pointLedger,
  reviewJobs,
  reviews,
  submissionVersions,
  submissions,
  weeklyRankings,
  weeks,
} from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { notifyBestEffort } from "@/server/notifications/service";
import { crossedThresholds, getLifetimePoints } from "@/server/rewards/milestones";
import { catalog } from "@/server/db/schema";
import { writeAudit } from "@/server/reviews/audit";
import { rankFinalists } from "./ranking";

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
    const validVersion = versions.find((version) => version.reviewAttemptNumber != null);
    if (!validVersion) continue;
    const runs = await db
      .select()
      .from(reviews)
      .where(eq(reviews.submissionVersionId, validVersion.id))
      .orderBy(desc(reviews.runNumber))
      .limit(1);
    const review = runs[0];
    if (!review || (review.status !== "COMPLETED_HIDDEN" && review.status !== "PUBLISHED")) continue;
    finalists.push({
      userId: enrollment.userId,
      enrollmentId: enrollment.id,
      projectId: enrollment.projectId,
      versionId: validVersion.id,
      reviewId: review.id,
      finalScore: Number(review.finalScore),
      finalSubmittedAt: validVersion.submittedAt,
    });
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
  const unresolved = await db
    .select({ id: reviews.id })
    .from(reviews)
    .innerJoin(submissionVersions, eq(reviews.submissionVersionId, submissionVersions.id))
    .innerJoin(submissions, eq(submissionVersions.submissionId, submissions.id))
    .where(and(eq(submissions.weekId, week.id), eq(reviews.status, "NEEDS_RESOLUTION")));
  if (openJobs.length > 0 || unresolved.length > 0) {
    throw new ArenaDomainError("WEEK_NOT_READY", "Pending reviews or unresolved disagreements must be resolved first.", {
      openJobs: openJobs.length,
      needsResolution: unresolved.length,
    });
  }

  const ranked = rankFinalists(await collectEligibleFinalists(db, week.id));
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
    // Best-effort inbox notices (PRD §36). Gated on a fresh award so an
    // idempotent re-finalize never double-notifies.
    if (ledgerRows.length > 0) {
      const previousLifetime = (await getLifetimePoints(finalist.userId, db)) - finalist.points;
      await notifyBestEffort({
        type: "RESULT_READY",
        userId: finalist.userId,
        weekId: week.id,
        title: `Hasil minggu ini: peringkat #${finalist.rank}`,
        body: `Skor akhirmu ${finalist.finalScore.toFixed(0)}/100. Lihat papan peringkat buat detailnya.`,
        actionUrl: "/app/arena",
      });
      await notifyBestEffort({
        type: "POINTS_AWARDED",
        userId: finalist.userId,
        weekId: week.id,
        title: `+${finalist.points} poin masuk`,
        body: `Peringkat #${finalist.rank} minggu ${week.weekCode}. Poin nggak kedaluwarsa — kumpulin buat ditukar reward.`,
        actionUrl: "/app/profile",
      });
      // Milestone nudge: newly-crossed catalog thresholds only.
      const activeCosts = (
        await db.select({ pointsCost: catalog.pointsCost }).from(catalog).where(eq(catalog.isActive, true))
      ).map((row) => row.pointsCost);
      const crossed = crossedThresholds(previousLifetime, finalist.points, activeCosts);
      for (const threshold of crossed) {
        await notifyBestEffort({
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

  await db.update(enrollments).set({ status: "VOIDED", updatedAt: now }).where(eq(enrollments.id, enrollment.id));
  await db
    .update(submissions)
    .set({ status: "VOIDED", updatedAt: now })
    .where(eq(submissions.enrollmentId, enrollment.id));

  let pointsRevoked = 0;
  const ranking = (
    await db
      .select()
      .from(weeklyRankings)
      .where(and(eq(weeklyRankings.weekId, week.id), eq(weeklyRankings.userId, enrollment.userId)))
  )[0];
  if (ranking && ranking.pointsAwarded > 0) {
    const reversal = await db
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
      await db
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
    await db.delete(weeklyRankings).where(eq(weeklyRankings.id, ranking.id));
  }

  await writeAudit(db, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "FRAUD_VOID",
    entityType: "enrollment",
    entityId: enrollment.id,
    metadata: { reason: input.reason, pointsRevoked, weekFinalized: week.status === "FINALIZED" },
  });
  return { enrollmentId: enrollment.id, pointsRevoked };
}
