import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireArenaAdmin } from "@/server/admin/auth";
import { overrideReview, rerunReview } from "@/server/reviews/admin";

export const dynamic = "force-dynamic";

const rerunSchema = z.object({
  versionId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
});

const overrideSchema = z.object({
  reviewId: z.string().uuid(),
  newScore: z.number().min(0).max(100),
  reason: z.string().trim().min(1).max(1000),
});

/**
 * Audited admin operations (PRD §31). Scoped admin access; every call records
 * server-derived actor + reason + before/after
 * state, never consumes a user attempt, and never deletes the original review.
 */
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "reviews");
    const { action } = await context.params;
    const body = await request.json().catch(() => null);
    if (action === "rerun") {
      const parsed = rerunSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
      return arenaData({ done: await rerunReview({ ...parsed.data, actorSubject }) });
    }
    if (action === "override") {
      const parsed = overrideSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
      return arenaData({ done: await overrideReview({ ...parsed.data, actorSubject }) });
    }
    return arenaData({ done: false, reason: "UNKNOWN_ACTION" }, 404);
  } catch (error) {
    return arenaError(error);
  }
}
