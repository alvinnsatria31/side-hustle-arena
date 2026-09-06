import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { catalog, divisions, enrollments, pointLedger, projects, redemptions, skillEvidence, skills, submissions, weeklyRankings, weeks, workspaceProgress } from "../db/schema";
import { getWeekSelectionState, resolveCurrentWeekFromCandidates } from "./week-service";

export async function getParticipantOverview(userId: string, db = getDb()) {
  const [weekRows, historyRows, totals, evidence, redemptionHistory] = await Promise.all([
    db.select().from(weeks).where(inArray(weeks.status, ["OPEN", "PREVIEW", "SCHEDULED", "CLOSED", "FINALIZING", "FINALIZED"])),
    db.select({
      id: enrollments.id, status: enrollments.status, selectedAt: enrollments.selectedAt,
      project: { id: projects.id, slug: projects.slug, title: projects.title, division: divisions.name },
      week: { id: weeks.id, weekCode: weeks.weekCode, title: weeks.title, status: weeks.status, submissionDeadlineAt: weeks.submissionDeadlineAt, finalizedAt: weeks.finalizedAt },
      workspace: { currentStep: workspaceProgress.currentStep, updatedAt: workspaceProgress.updatedAt },
      submission: { status: submissions.status, latestVersionId: submissions.latestVersionId },
      ranking: { rank: weeklyRankings.rank, finalScore: weeklyRankings.finalScore, pointsAwarded: weeklyRankings.pointsAwarded },
    }).from(enrollments)
      .innerJoin(projects, eq(enrollments.projectId, projects.id))
      .innerJoin(divisions, eq(projects.divisionId, divisions.id))
      .innerJoin(weeks, eq(enrollments.weekId, weeks.id))
      .leftJoin(workspaceProgress, eq(workspaceProgress.enrollmentId, enrollments.id))
      .leftJoin(submissions, eq(submissions.enrollmentId, enrollments.id))
      .leftJoin(weeklyRankings, and(eq(weeklyRankings.userId, enrollments.userId), eq(weeklyRankings.weekId, enrollments.weekId), eq(weeklyRankings.projectId, enrollments.projectId), eq(weeks.status, "FINALIZED")))
      .where(eq(enrollments.userId, userId)).orderBy(desc(weeks.opensAt)),
    db.select({
      balance: sql<number>`coalesce(sum(${pointLedger.amount}), 0)`.mapWith(Number),
      lifetimeEarned: sql<number>`coalesce(sum(case when ${pointLedger.amount} > 0 and ${pointLedger.entryType} not in ('ADMIN_REVERSAL', 'REWARD_REDEMPTION') and coalesce(${pointLedger.referenceType}, '') not in ('redemption', 'reward_redemption', 'redemption_refund') then ${pointLedger.amount} else 0 end), 0)`.mapWith(Number),
    }).from(pointLedger).where(eq(pointLedger.userId, userId)),
    db.select({ id: skillEvidence.id, skillId: skills.id, name: skills.name, score: skillEvidence.score, summary: skillEvidence.evidenceSummary, projectSlug: projects.slug, projectTitle: projects.title, weekCode: weeks.weekCode })
      .from(skillEvidence)
      .innerJoin(weeklyRankings, and(eq(skillEvidence.reviewId, weeklyRankings.reviewId), eq(skillEvidence.userId, weeklyRankings.userId), eq(skillEvidence.weekId, weeklyRankings.weekId), eq(skillEvidence.projectId, weeklyRankings.projectId)))
      .innerJoin(weeks, and(eq(skillEvidence.weekId, weeks.id), eq(weeks.status, "FINALIZED")))
      .innerJoin(skills, eq(skillEvidence.skillId, skills.id))
      .innerJoin(projects, eq(skillEvidence.projectId, projects.id))
      .where(eq(skillEvidence.userId, userId)).orderBy(desc(weeks.opensAt), skills.name),
    db.select({ id: redemptions.id, slug: catalog.slug, title: catalog.title, pointsSpent: redemptions.pointsSpent, status: redemptions.status, redeemedAt: redemptions.redeemedAt, fulfilledAt: redemptions.fulfilledAt })
      .from(redemptions).innerJoin(catalog, eq(redemptions.rewardId, catalog.id))
      .where(eq(redemptions.userId, userId)).orderBy(desc(redemptions.redeemedAt)),
  ]);
  const current = resolveCurrentWeekFromCandidates(weekRows);
  const currentWeek = weekRows.find((week) => week.id === current?.id);
  const history = historyRows.map((row) => ({
    ...row,
    selectedAt: row.selectedAt.toISOString(),
    week: { ...row.week, submissionDeadlineAt: row.week.submissionDeadlineAt.toISOString(), finalizedAt: row.week.finalizedAt?.toISOString() ?? null },
    workspace: row.workspace ? { ...row.workspace, updatedAt: row.workspace.updatedAt.toISOString() } : null,
    ranking: row.ranking ? { ...row.ranking, finalScore: Number(row.ranking.finalScore) } : null,
    sealed: row.week.status !== "FINALIZED",
  }));
  return {
    currentWeek: currentWeek ? { id: currentWeek.id, weekCode: currentWeek.weekCode, title: currentWeek.title, status: currentWeek.status, submissionDeadlineAt: currentWeek.submissionDeadlineAt.toISOString(), canSelect: getWeekSelectionState(currentWeek).canSelect } : null,
    currentEnrollmentId: history.find((row) => row.week.id === current?.id)?.id ?? null,
    history,
    points: totals[0] ?? { balance: 0, lifetimeEarned: 0 },
    completedProjects: history.filter((row) => row.ranking !== null).length,
    provenSkills: new Set(evidence.map((row) => row.skillId)).size,
    skillEvidence: evidence.map((row) => ({ ...row, score: Number(row.score) })),
    redemptions: redemptionHistory.map((row) => ({ ...row, redeemedAt: row.redeemedAt.toISOString(), fulfilledAt: row.fulfilledAt?.toISOString() ?? null })),
  };
}

export type ParticipantOverview = Awaited<ReturnType<typeof getParticipantOverview>>;
