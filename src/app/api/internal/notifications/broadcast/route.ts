import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { broadcastWeekNotification } from "@/server/notifications/service";

export const dynamic = "force-dynamic";

const broadcastSchema = z.object({
  type: z.enum(["PROJECT_DROP", "DEADLINE_REMINDER"]),
  weekId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(1000),
  actionUrl: z.string().trim().max(500).nullable().optional(),
});

/**
 * Scheduler-owned broadcasts (Monday drop, Friday reminder). Called by
 * Hermes/cron — there is no in-app scheduler yet. One inbox event per
 * enrolled user of the week.
 */
export async function POST(request: Request) {
  try {
    requireAutomationWorker(request);
    const parsed = broadcastSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ done: await broadcastWeekNotification(parsed.data) });
  } catch (error) {
    return arenaError(error);
  }
}
