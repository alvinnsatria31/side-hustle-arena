import { arenaData, arenaError } from "@/server/arena/http";
import { getCurrentUser } from "@/server/auth";
import { listOwnedSlugs, listStoreProducts } from "@/server/store/catalog-service";
import { isRupiahCheckoutConfigured, requireStoreEnabled } from "@/server/store/config";

export const dynamic = "force-dynamic";

/**
 * The shelf. Readable signed out — a shop nobody can look into sells nothing.
 *
 * `owned` is returned alongside rather than as a second endpoint so the grid can
 * mark what the visitor already has without a waterfall of requests.
 */
export async function GET() {
  try {
    requireStoreEnabled();
    const user = await getCurrentUser();
    const [items, owned] = await Promise.all([
      listStoreProducts(),
      user ? listOwnedSlugs(user.id) : Promise.resolve([]),
    ]);
    return arenaData({ items, owned, rupiahAvailable: isRupiahCheckoutConfigured() });
  } catch (error) {
    return arenaError(error);
  }
}
