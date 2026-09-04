import { arenaData, arenaError } from "@/server/arena";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { getOpsOverview } from "@/server/admin/overview";

export const dynamic = "force-dynamic";

/** Read-only ops overview: week, queue, resolution backlog, flags, rewards, audit. */
export async function GET(request: Request) {
  try {
    requireAutomationWorker(request);
    return arenaData({ overview: await getOpsOverview() });
  } catch (error) {
    return arenaError(error);
  }
}
