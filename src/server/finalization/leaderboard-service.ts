import "server-only";
import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { divisions, projects, users, weeklyRankings, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";

type Db = ReturnType<typeof getDb>;

export interface LeaderboardRow {
  rank: number;
  displayName: string;
  /** The preset they picked, or null; the client degrades an unknown id itself. */
  avatarId: string | null;
  projectTitle: string;
  divisionName: string;
  finalScore: number;
  pointsAwarded: number;
  finalSubmittedAt: Date;
}

/** Public weekly leaderboard. Only FINALIZED weeks are published (PRD §33). */
export async function listWeekLeaderboard(
  input: { weekId?: string; weekCode?: string; now?: Date } = {},
  db: Db = getDb(),
): Promise<{ weekCode: string; finalizedAt: Date | null; rows: LeaderboardRow[] }> {
  const weekRows = input.weekId
    ? await db.select().from(weeks).where(eq(weeks.id, input.weekId))
    : input.weekCode
      ? await db.select().from(weeks).where(eq(weeks.weekCode, input.weekCode))
      : [];
  let week = weekRows[0];
  if (!week && !input.weekId && !input.weekCode) {
    const finalized = await db.select().from(weeks).where(eq(weeks.status, "FINALIZED"));
    finalized.sort((a, b) => (b.finalizedAt?.getTime() ?? 0) - (a.finalizedAt?.getTime() ?? 0));
    week = finalized[0];
  }
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Arena week not found.");
  if (week.status !== "FINALIZED") {
    throw new ArenaDomainError("WEEK_NOT_FINALIZED", "Leaderboard is published after weekly finalization.");
  }
  const rows = await db
    .select({
      rank: weeklyRankings.rank,
      displayName: users.displayNameCache,
      avatarId: users.avatarId,
      userId: users.id,
      projectTitle: projects.title,
      divisionName: divisions.name,
      finalScore: weeklyRankings.finalScore,
      pointsAwarded: weeklyRankings.pointsAwarded,
      finalSubmittedAt: weeklyRankings.finalSubmittedAt,
    })
    .from(weeklyRankings)
    .innerJoin(users, eq(weeklyRankings.userId, users.id))
    .innerJoin(projects, eq(weeklyRankings.projectId, projects.id))
    .innerJoin(divisions, eq(projects.divisionId, divisions.id))
    .where(eq(weeklyRankings.weekId, week.id))
    .orderBy(asc(weeklyRankings.rank));
  return {
    weekCode: week.weekCode,
    finalizedAt: week.finalizedAt,
    rows: rows.map((row) => ({
      rank: row.rank,
      displayName: row.displayName ?? `Peserta ${row.userId.slice(0, 8)}`,
      avatarId: row.avatarId,
      projectTitle: row.projectTitle,
      divisionName: row.divisionName,
      finalScore: Number(row.finalScore),
      pointsAwarded: row.pointsAwarded,
      finalSubmittedAt: row.finalSubmittedAt,
    })),
  };
}

export interface AllTimeLeaderboardRow {
  rank: number;
  displayName: string;
  avatarId: string | null;
  /** Points awarded across every finalized week — the Arena's equivalent of XP. */
  totalPoints: number;
  weeksRanked: number;
  bestRank: number;
  averageScore: number;
  /** Division of their most recent ranked project, for the avatar badge. */
  latestDivisionName: string | null;
}

/**
 * All-time standings, summed from the published weekly rankings.
 *
 * Built only from FINALIZED weeks, so it can never reveal a result the weekly
 * board is still holding back. A voided enrollment deletes its ranking row, so
 * revoked points drop out of the sum without special handling here.
 */
export interface AllTimeViewer {
  rank: number;
  totalPoints: number;
  weeksRanked: number;
}

export async function listAllTimeLeaderboard(
  input: { limit?: number; viewerId?: string | null } = {},
  db: Db = getDb(),
): Promise<{ weeksCounted: number; latestFinalizedAt: Date | null; rows: AllTimeLeaderboardRow[]; viewer: AllTimeViewer | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const finalized = and(eq(weeklyRankings.weekId, weeks.id), eq(weeks.status, "FINALIZED"));
  const totalPoints = sql<number>`sum(${weeklyRankings.pointsAwarded})`.mapWith(Number);
  const bestRank = sql<number>`min(${weeklyRankings.rank})`.mapWith(Number);
  const weeksRanked = sql<number>`count(*)`.mapWith(Number);
  const averageScore = sql<number>`avg(${weeklyRankings.finalScore})`.mapWith(Number);

  const [standings, meta] = await Promise.all([
    db
      .select({ userId: weeklyRankings.userId, totalPoints, bestRank, weeksRanked, averageScore })
      .from(weeklyRankings)
      .innerJoin(weeks, finalized)
      .groupBy(weeklyRankings.userId)
      .orderBy(desc(totalPoints), asc(bestRank), desc(weeksRanked), asc(weeklyRankings.userId))
      .limit(limit),
    db
      .select({ weeksCounted: sql<number>`count(*)`.mapWith(Number), latestFinalizedAt: max(weeks.finalizedAt) })
      .from(weeks)
      .where(eq(weeks.status, "FINALIZED")),
  ]);
  if (!standings.length) {
    return { weeksCounted: meta[0]?.weeksCounted ?? 0, latestFinalizedAt: meta[0]?.latestFinalizedAt ?? null, rows: [], viewer: null };
  }

  const userIds = standings.map((row) => row.userId);
  const [people, placements] = await Promise.all([
    db.select({ id: users.id, displayName: users.displayNameCache, avatarId: users.avatarId }).from(users).where(inArray(users.id, userIds)),
    db
      .select({ userId: weeklyRankings.userId, divisionName: divisions.name, finalizedAt: weeks.finalizedAt })
      .from(weeklyRankings)
      .innerJoin(weeks, finalized)
      .innerJoin(projects, eq(weeklyRankings.projectId, projects.id))
      .innerJoin(divisions, eq(projects.divisionId, divisions.id))
      .where(inArray(weeklyRankings.userId, userIds)),
  ]);
  const byId = new Map(people.map((person) => [person.id, person]));
  const latestDivision = new Map<string, { name: string; at: number }>();
  for (const placement of placements) {
    const at = placement.finalizedAt?.getTime() ?? 0;
    const current = latestDivision.get(placement.userId);
    if (!current || at > current.at) latestDivision.set(placement.userId, { name: placement.divisionName, at });
  }

  return {
    weeksCounted: meta[0]?.weeksCounted ?? 0,
    latestFinalizedAt: meta[0]?.latestFinalizedAt ?? null,
    viewer: input.viewerId ? await allTimeViewer(input.viewerId, standings, db) : null,
    rows: standings.map((row, index) => {
      const person = byId.get(row.userId);
      return {
        rank: index + 1,
        displayName: person?.displayName ?? `Peserta ${row.userId.slice(0, 8)}`,
        avatarId: person?.avatarId ?? null,
        totalPoints: row.totalPoints,
        weeksRanked: row.weeksRanked,
        bestRank: row.bestRank,
        averageScore: Math.round(row.averageScore * 10) / 10,
        latestDivisionName: latestDivision.get(row.userId)?.name ?? null,
      };
    }),
  };
}

/**
 * The signed-in person's own all-time placing. Public rows carry no user key,
 * so "which one is me" is answered here, server-side, and only for the viewer.
 * Outside the listed top, the rank counts everyone strictly ahead on points.
 */
async function allTimeViewer(
  viewerId: string,
  standings: Array<{ userId: string; totalPoints: number; weeksRanked: number }>,
  db: Db,
): Promise<AllTimeViewer | null> {
  const listed = standings.findIndex((row) => row.userId === viewerId);
  if (listed >= 0) return { rank: listed + 1, totalPoints: standings[listed].totalPoints, weeksRanked: standings[listed].weeksRanked };
  const own = await db
    .select({ totalPoints: sql<number>`coalesce(sum(${weeklyRankings.pointsAwarded}), 0)`.mapWith(Number), weeksRanked: sql<number>`count(*)`.mapWith(Number) })
    .from(weeklyRankings)
    .innerJoin(weeks, and(eq(weeklyRankings.weekId, weeks.id), eq(weeks.status, "FINALIZED")))
    .where(eq(weeklyRankings.userId, viewerId));
  if (!own[0]?.weeksRanked) return null;
  const totals = db
    .select({ total: sql<number>`sum(${weeklyRankings.pointsAwarded})`.as("total") })
    .from(weeklyRankings)
    .innerJoin(weeks, and(eq(weeklyRankings.weekId, weeks.id), eq(weeks.status, "FINALIZED")))
    .groupBy(weeklyRankings.userId)
    .as("totals");
  const ahead = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(totals)
    .where(sql`${totals.total} > ${own[0].totalPoints}`);
  return { rank: (ahead[0]?.count ?? 0) + 1, totalPoints: own[0].totalPoints, weeksRanked: own[0].weeksRanked };
}
