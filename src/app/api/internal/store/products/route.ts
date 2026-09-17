import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { createProduct, listAdminProducts } from "@/server/store/admin-service";
import { storeProductSchema } from "@/server/store/schemas";

export const dynamic = "force-dynamic";

/**
 * The console's view of the catalog: every product, including drafts.
 *
 * Not behind the shop's feature flag on purpose. Filling the shelf is precisely
 * what happens while the shop is still closed.
 */
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "store");
    return arenaData({ products: await listAdminProducts() });
  } catch (error) {
    return arenaError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "store");
    const parsed = storeProductSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
    return arenaData({ product: await createProduct({ product: parsed.data, actorSubject }) }, 201);
  } catch (error) {
    return arenaError(error);
  }
}
