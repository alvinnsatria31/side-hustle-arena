import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireArenaAdmin } from "@/server/admin/auth";
import { closeWeekForFinalization, finalizeWeek } from "@/server/finalization/service";

export const dynamic = "force-dynamic";

const closeSchema = z.object({
  weekId: z.string().uuid().optional(),
  weekCode: z.string().trim().min(1).max(64).optional(),
  force: z.boolean().optional(),
}).refine((value) => value.weekId ?? value.weekCode, "weekId or weekCode is required.");

const finalizeSchema = z.object({
  weekId: z.string().uuid(),
});

/** Friday close (deadline-gated unless forced) and finalization (rank + award + publish). */
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "weeks");
    const { action } = await context.params;
    const body = await request.json().catch(() => null);
    if (action === "close") {
      const parsed = closeSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
      return arenaData({ done: await closeWeekForFinalization({ ...parsed.data, actorSubject }) });
    }
    if (action === "finalize") {
      const parsed = finalizeSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
      return arenaData({ done: await finalizeWeek({ ...parsed.data, actorSubject }) });
    }
    return arenaData({ done: false, reason: "UNKNOWN_ACTION" }, 404);
  } catch (error) {
    return arenaError(error);
  }
}
