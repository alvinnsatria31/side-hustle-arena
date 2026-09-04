import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { flushPendingEmails } from "@/server/notifications/service";

export const dynamic = "force-dynamic";

const flushSchema = z.object({ limit: z.number().int().min(1).max(100).optional() });

/** Drain queued EMAIL deliveries (called by Hermes/cron). */
export async function POST(request: Request) {
  try {
    requireAutomationWorker(request);
    const parsed = flushSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ done: await flushPendingEmails(parsed.data) });
  } catch (error) {
    return arenaError(error);
  }
}
