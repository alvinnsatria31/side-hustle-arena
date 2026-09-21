import { getCurrentUser } from "@/server/auth";
import { arenaData, arenaError, arenaUnauthorized } from "@/server/arena/http";
import { getPointSummary } from "@/server/rewards/activity-service";

export const dynamic = "force-dynamic";

/** Own wallet: balance and totals, plus `?recent=N` (max 20) labelled ledger entries. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    const recent = Number(new URL(request.url).searchParams.get("recent") ?? 0);
    return arenaData(await getPointSummary(user.id, { recent: Number.isFinite(recent) ? recent : 0 }));
  } catch (error) {
    return arenaError(error);
  }
}
