import { arenaData, arenaError } from "@/server/arena";
import { getCurrentUser } from "@/server/auth";
import { listAllTimeLeaderboard, listWeekLeaderboard } from "@/server/finalization/leaderboard-service";

export const dynamic = "force-dynamic";

/**
 * Public leaderboard. `?week=<week_code>` for a specific finalized week,
 * otherwise the most recently finalized week. `?scope=all` returns the
 * all-time standings summed over finalized weeks, plus the signed-in viewer's
 * own placing when there is one. Unfinalized weeks are never exposed (results
 * stay hidden until finalization, PRD §33).
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if (params.get("scope") === "all") {
      const viewer = await getCurrentUser().catch(() => null);
      return arenaData(await listAllTimeLeaderboard({ viewerId: viewer?.id ?? null }));
    }
    const week = params.get("week") ?? undefined;
    return arenaData(await listWeekLeaderboard({ weekCode: week }));
  } catch (error) {
    return arenaError(error);
  }
}
