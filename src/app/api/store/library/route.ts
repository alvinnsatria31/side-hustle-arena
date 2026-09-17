import { arenaData, arenaError, arenaUnauthorized } from "@/server/arena/http";
import { getCurrentUser } from "@/server/auth";
import { requireStoreEnabled } from "@/server/store/config";
import { listOwnedProducts } from "@/server/store/entitlement-service";
import { listUserOrders } from "@/server/store/checkout-service";

export const dynamic = "force-dynamic";

/** "Produk Saya": what this person owns, and the receipts behind it. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  try {
    requireStoreEnabled();
    const [owned, orders] = await Promise.all([listOwnedProducts(user.id), listUserOrders(user.id)]);
    return arenaData({ owned, orders });
  } catch (error) {
    return arenaError(error);
  }
}
