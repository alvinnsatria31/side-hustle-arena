import "server-only";
import { asc, eq } from "drizzle-orm";
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
