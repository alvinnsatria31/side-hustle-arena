import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { attributeProjectCriteria, criteriaAttributionSchema, setAdminProjectSchedule } from "@/server/admin/content";
import { reviewProject } from "@/server/generation/service";

export const dynamic = "force-dynamic";

const reason = z.string().trim().min(1).max(1000);
const reviewSchema = z.object({ reason });
const editSchema = z.object({ reason, package: z.unknown() });
const scheduleSchema = z.object({ reason, scheduledPublishAt: z.string().min(1).nullable() });

/**
 * Project lifecycle, all of it through the domain service.
 *
 * `edit` deliberately re-submits the whole package rather than patching
 * columns: `reviewProject` revalidates it and rewrites the validation record,
 * and without that `publishWeek` would later refuse the project for having
 * changed after validation. Approving is also the operator's fast path — an
 * APPROVED preview skips the minimum preview interval, which is what makes a
 * same-day launch possible at all.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "projects");
    const { id, action } = await context.params;
    const body = await request.json().catch(() => null);

    if (action === "approve" || action === "veto" || action === "regenerate") {
      const parsed = reviewSchema.safeParse(body);
      if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
      return arenaData(await reviewProject({ projectId: id, action, reason: parsed.data.reason, actorSubject }));
    }
    if (action === "edit") {
      const parsed = editSchema.safeParse(body);
      if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
      return arenaData(await reviewProject({ projectId: id, action: "edit", reason: parsed.data.reason, package: parsed.data.package, actorSubject }));
    }
    if (action === "attribute") {
      // Rubric criterion → skill on a live project; drafts carry it in `edit`.
      const parsed = criteriaAttributionSchema.safeParse(body);
      if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
      return arenaData(await attributeProjectCriteria({ projectId: id, ...parsed.data, actorSubject }));
    }
    if (action === "schedule") {
      const parsed = scheduleSchema.safeParse(body);
      if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
      return arenaData(await setAdminProjectSchedule({ projectId: id, ...parsed.data, actorSubject }));
    }
    return arenaData({ reason: "UNKNOWN_ACTION" }, 404);
  } catch (error) { return arenaError(error); }
}
