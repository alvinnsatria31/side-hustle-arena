import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { overrideReview, rerunReview } from "@/server/reviews/admin";

export const dynamic = "force-dynamic";

const rerunSchema = z.object({
  versionId: z.string().uuid(),
  actorSubject: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1000),
});

const overrideSchema = z.object({
  reviewId: z.string().uuid(),
  actorSubject: z.string().trim().min(1).max(200),
  newScore: z.number().min(0).max(100),
  reason: z.string().trim().min(1).max(1000),
});

/**
 * Audited admin operations (PRD §31). Internal-bearer gated until the admin
 * authorization model lands; every call records actor + reason + before/after
 * state, never consumes a user attempt, and never deletes the original review.
 */
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    requireAutomationWorker(request);
    const { action } = await context.params;
    const body = await request.json().catch(() => null);
    if (action === "rerun") {
      const parsed = rerunSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
      return arenaData({ done: await rerunReview(parsed.data) });
    }
    if (action === "override") {
      const parsed = overrideSchema.safeParse(body);
      if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
      return arenaData({ done: await overrideReview(parsed.data) });
    }
    return arenaData({ done: false, reason: "UNKNOWN_ACTION" }, 404);
  } catch (error) {
    return arenaError(error);
  }
}
