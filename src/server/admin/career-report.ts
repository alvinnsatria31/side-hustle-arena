import "server-only";
import { and, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { cvScans, enrollments, pointAccounts, skillEvidence, users, weeklyRankings, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { PUBLISHED_WEEK_STATUSES } from "@/server/arena/published-weeks";
import { writeAudit } from "@/server/reviews/audit";
import { getCareerReport } from "@/server/career/report-service";

type Db = ReturnType<typeof getDb>;

export const careerReportListQuery = z.object({
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  q: z.string().trim().max(200).default(""),
});

const average = (values: number[]) => values.length
  ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
  : null;

/**
 * One row per participant, summarising what their Career Report shows.
 *
 * Career Report is computed on the fly and never stored, so this reads the
 * same sources with the same rules rather than inventing a table:
 * - a project counts only once its week is FINALIZED and its ranking survived
 *   (voiding deletes the ranking row);
 * - a skill's score is the average of its CRITERION evidence — measured by a
 *   rubric criterion — and skills that only carry the project score are
 *   counted, never averaged in, exactly as the report keeps them apart;
 * - the CV is the latest scan, shown as its own claim, never merged.
 *
 * A "participant" is anyone with an Arena enrollment or a saved CV scan, so
 * admins and never-active accounts do not pad the list.
 */
export async function listAdminCareerReports(query: z.infer<typeof careerReportListQuery>, db: Db = getDb()) {
  const search = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
  const page = await db.select({
    id: users.id, authSubject: users.authSubject, name: users.displayNameCache, email: users.emailCache,
    status: users.status, createdAt: users.createdAt,
  }).from(users)
    .where(and(
      or(
        exists(db.select({ one: sql`1` }).from(enrollments).where(eq(enrollments.userId, users.id))),
        exists(db.select({ one: sql`1` }).from(cvScans).where(eq(cvScans.userId, users.id))),
      ),
      query.q ? or(ilike(users.authSubject, search), ilike(users.displayNameCache, search), ilike(users.emailCache, search)) : undefined,
    ))
    .orderBy(desc(users.createdAt), users.id).limit(query.limit).offset(query.offset);
  if (!page.length) return [];
  const ids = page.map((user) => user.id);

  const [results, evidence, latestCv, points, enrollmentCounts] = await Promise.all([
    db.select({
      userId: weeklyRankings.userId,
      count: sql<number>`count(*)::int`,
      scores: sql<string[]>`array_agg(${weeklyRankings.finalScore}::text)`,
      lastFinalizedAt: sql<string | null>`max(${weeks.finalizedAt})::text`,
    }).from(weeklyRankings).innerJoin(weeks, eq(weeks.id, weeklyRankings.weekId))
      .where(and(inArray(weeklyRankings.userId, ids), inArray(weeks.status, [...PUBLISHED_WEEK_STATUSES])))
      .groupBy(weeklyRankings.userId),
    db.select({ userId: skillEvidence.userId, skillId: skillEvidence.skillId, attribution: skillEvidence.attribution, score: skillEvidence.score })
      .from(skillEvidence)
      .innerJoin(weeklyRankings, eq(weeklyRankings.reviewId, skillEvidence.reviewId))
      .innerJoin(weeks, eq(weeks.id, skillEvidence.weekId))
      .where(and(inArray(skillEvidence.userId, ids), inArray(weeks.status, [...PUBLISHED_WEEK_STATUSES]))),
    db.selectDistinctOn([cvScans.userId], { userId: cvScans.userId, result: cvScans.result, createdAt: cvScans.createdAt })
      .from(cvScans).where(inArray(cvScans.userId, ids)).orderBy(cvScans.userId, desc(cvScans.createdAt)),
    db.select({ userId: pointAccounts.userId, balance: pointAccounts.balance, lifetimeEarned: pointAccounts.lifetimeEarned })
      .from(pointAccounts).where(inArray(pointAccounts.userId, ids)),
    db.select({ userId: enrollments.userId, count: sql<number>`count(*)::int` })
      .from(enrollments).where(inArray(enrollments.userId, ids)).groupBy(enrollments.userId),
  ]);

  const resultBy = new Map(results.map((row) => [row.userId, row]));
  const pointsBy = new Map(points.map((row) => [row.userId, row]));
  const enrollmentBy = new Map(enrollmentCounts.map((row) => [row.userId, row.count]));
  const cvBy = new Map(latestCv.map((row) => [row.userId, row]));
  const skillsBy = new Map<string, { measured: Map<string, number[]>; all: Set<string> }>();
  for (const row of evidence) {
    const bucket = skillsBy.get(row.userId) ?? { measured: new Map<string, number[]>(), all: new Set<string>() };
    bucket.all.add(row.skillId);
    if (row.attribution === "CRITERION") {
      const scores = bucket.measured.get(row.skillId) ?? [];
      scores.push(Number(row.score));
      bucket.measured.set(row.skillId, scores);
    }
    skillsBy.set(row.userId, bucket);
  }

  return page.map((user) => {
    const result = resultBy.get(user.id);
    const skills = skillsBy.get(user.id);
    const measuredScores = skills ? [...skills.measured.values()].map((scores) => average(scores)!).filter((score) => score !== null) : [];
    const cv = cvBy.get(user.id);
    const cvResult = (cv?.result ?? null) as { score?: unknown; statusLabel?: unknown } | null;
    return {
      ...user,
      enrollments: enrollmentBy.get(user.id) ?? 0,
      projectsCompleted: result?.count ?? 0,
      averageScore: average((result?.scores ?? []).map(Number)),
      lastFinalizedAt: result?.lastFinalizedAt ?? null,
      /** Mean of each measured skill's score — the report's per-skill numbers, averaged. */
      skillScoreAverage: average(measuredScores),
      measuredSkills: measuredScores.length,
      evidencedSkills: skills?.all.size ?? 0,
      points: { balance: pointsBy.get(user.id)?.balance ?? 0, lifetimeEarned: pointsBy.get(user.id)?.lifetimeEarned ?? 0 },
      cv: cv
        ? {
          score: typeof cvResult?.score === "number" ? cvResult.score : null,
          statusLabel: typeof cvResult?.statusLabel === "string" ? cvResult.statusLabel : null,
          scannedAt: cv.createdAt,
        }
        : null,
    };
  });
}

/**
 * The participant's Career Report exactly as they see it, for an admin
 * answering a complaint. It holds their CV claims, so every preview is written
 * to the audit log: who looked, at whose report, and when.
 */
export async function previewAdminCareerReport(input: { userId: string; actorSubject: string; db?: Db }) {
  const db = input.db ?? getDb();
  if (!input.actorSubject.trim()) throw new ArenaDomainError("VALIDATION_ERROR", "Actor is required.");
  const [user] = await db.select({ id: users.id, authSubject: users.authSubject, name: users.displayNameCache, email: users.emailCache, status: users.status })
    .from(users).where(eq(users.id, input.userId));
  if (!user) throw new ArenaDomainError("VALIDATION_ERROR", "Participant not found.");
  const report = await getCareerReport(user.id, db);
  await writeAudit(db, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "CAREER_REPORT_VIEWED", entityType: "user", entityId: user.id,
    metadata: { purpose: "admin-preview" } });
  return { user, report };
}
