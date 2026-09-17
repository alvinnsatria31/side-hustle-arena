import { arenaData, arenaError } from "@/server/arena/http";
import { getCurrentUser } from "@/server/auth";
import { getStoreProduct, listOwnedSlugs } from "@/server/store/catalog-service";
import { requireStoreEnabled } from "@/server/store/config";
import { storeSlugSchema } from "@/server/store/schemas";

export const dynamic = "force-dynamic";


export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    requireStoreEnabled();
    const { slug } = await context.params;
    const parsed = storeSlugSchema.safeParse(slug);
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    const user = await getCurrentUser();
    const [product, owned] = await Promise.all([
      getStoreProduct(parsed.data),
      user ? listOwnedSlugs(user.id) : Promise.resolve([]),
    ]);
    return arenaData({ product, owned: owned.includes(parsed.data) });
  } catch (error) {
    return arenaError(error);
  }
}
