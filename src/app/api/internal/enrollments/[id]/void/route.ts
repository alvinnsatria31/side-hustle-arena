import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireArenaAdmin } from "@/server/admin/auth";
import { voidEnrollment } from "@/server/finalization/service";

export const dynamic = "force-dynamic";

const voidSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

/** Fraud/plagiarism void for one enrollment (PRD §32). Audited; revokes post-finalize points. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "reviews");
    const { id } = await context.params;
    const parsed = voidSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !z.string().uuid().safeParse(id).success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ done: await voidEnrollment({ enrollmentId: id, ...parsed.data, actorSubject }) });
  } catch (error) {
    return arenaError(error);
  }
}
