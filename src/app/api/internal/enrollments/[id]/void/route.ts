import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { voidEnrollment } from "@/server/finalization/service";

export const dynamic = "force-dynamic";

const voidSchema = z.object({
  actorSubject: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1000),
});

/** Fraud/plagiarism void for one enrollment (PRD §32). Audited; revokes post-finalize points. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAutomationWorker(request);
    const { id } = await context.params;
    const parsed = voidSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ done: await voidEnrollment({ enrollmentId: id, ...parsed.data }) });
  } catch (error) {
    return arenaError(error);
  }
}
