import { getCurrentUser } from "@/server/auth";
import { arenaData, arenaError, arenaUnauthorized } from "@/server/arena";
import { getMilestoneLadder } from "@/server/rewards/milestones";

export const dynamic = "force-dynamic";

/** Own milestone ladder: lifetime points vs active catalog thresholds. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  try {
    return arenaData({ ladder: await getMilestoneLadder(user.id) });
  } catch (error) {
    return arenaError(error);
  }
}
