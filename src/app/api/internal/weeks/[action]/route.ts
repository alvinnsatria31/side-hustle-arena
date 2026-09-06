import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireArenaAdmin, type ArenaAdminScope } from "@/server/admin/auth";
import { closeWeekForFinalization, finalizeWeek } from "@/server/finalization/service";
import { createAdminWeek, rescheduleAdminWeek, weekCreateSchema, weekRescheduleSchema } from "@/server/admin/content";
import { createGenerationProvider } from "@/server/generation/ai-provider";
import { generateWeek, publishWeek } from "@/server/generation/service";

export const dynamic = "force-dynamic";

const closeSchema = z.object({
  weekId: z.string().uuid().optional(),
  weekCode: z.string().trim().min(1).max(64).optional(),
  force: z.boolean().optional(),
}).refine((value) => value.weekId ?? value.weekCode, "weekId or weekCode is required.");

const finalizeSchema = z.object({
  weekId: z.string().uuid(),
});

const generateSchema = z.object({
  weekId: z.string().uuid(),
  divisionId: z.string().uuid().optional(),
});

const publishSchema = z.object({
  weekId: z.string().uuid(),
});

/**
 * Content lifecycle is owned by `projects`, calendar lifecycle by `weeks`.
 *
 * The scope is chosen from the action rather than fixed for the route, so an
 * operator granted only `weeks` can move dates without also gaining the right
 * to generate or publish content.
 */
const SCOPES = {
  close: "weeks", finalize: "weeks", create: "weeks", reschedule: "weeks",
  generate: "projects", publish: "projects",
} satisfies Record<string, ArenaAdminScope>;

/** Friday close, finalization (rank + award + publish), and the off-schedule launch path. */
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await context.params;
    const scope = Object.hasOwn(SCOPES, action) ? SCOPES[action as keyof typeof SCOPES] : "weeks";
    const { actorSubject } = await requireArenaAdmin(request, scope);
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
    if (action === "create") {
      const parsed = weekCreateSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues.map((i) => i.message) }, 400);
      return arenaData({ week: await createAdminWeek({ ...parsed.data, actorSubject }) });
    }
    if (action === "reschedule") {
      const parsed = weekRescheduleSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR", issues: parsed.error.issues.map((i) => i.message) }, 400);
      return arenaData({ week: await rescheduleAdminWeek({ ...parsed.data, actorSubject }) });
    }
    if (action === "generate") {
      const parsed = generateSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
      // No configured model means library-only generation, exactly as the
      // scheduled job behaves; it is a narrower run, never a failure.
      const provider = createGenerationProvider() ?? undefined;
      const result = await generateWeek({ ...parsed.data, provider, actorSubject });
      return arenaData({ ...result, provider: provider?.name ?? "library-only" });
    }
    if (action === "publish") {
      const parsed = publishSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
      return arenaData(await publishWeek({ ...parsed.data, actorSubject }));
    }
    return arenaData({ done: false, reason: "UNKNOWN_ACTION" }, 404);
  } catch (error) {
    return arenaError(error);
  }
}
