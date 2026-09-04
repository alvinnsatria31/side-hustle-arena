import { arenaData, arenaError } from "@/server/arena";
import { listWeekLeaderboard } from "@/server/finalization/leaderboard-service";

export const dynamic = "force-dynamic";

/**
 * Public leaderboard. `?week=<week_code>` for a specific finalized week,
 * otherwise the most recently finalized week. Unfinalized weeks are never
 * exposed (results stay hidden until finalization, PRD §33).
 */
export async function GET(request: Request) {
  try {
    const week = new URL(request.url).searchParams.get("week") ?? undefined;
    return arenaData(await listWeekLeaderboard({ weekCode: week }));
  } catch (error) {
    return arenaError(error);
  }
}
