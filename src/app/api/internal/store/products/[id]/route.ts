import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { updateProduct } from "@/server/store/admin-service";
import { storeProductSchema } from "@/server/store/schemas";

export const dynamic = "force-dynamic";

/**
 * Save a product.
 *
 * A whole-row replace rather than a partial patch: the rules that decide whether
 * a product may go ACTIVE read every field at once, and a patch carrying half of
 * them makes "is this sellable?" unanswerable without first merging against what
 * is stored — two sources of truth for one decision.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "store");
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    const parsed = storeProductSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
    return arenaData({ product: await updateProduct({ productId: id, product: parsed.data, actorSubject }) });
  } catch (error) {
    return arenaError(error);
  }
}
