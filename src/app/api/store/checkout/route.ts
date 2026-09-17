import { arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena/http";
import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { requireStoreEnabled } from "@/server/store/config";
import { startCheckout } from "@/server/store/checkout-service";
import { storeCheckoutSchema } from "@/server/store/schemas";

export const dynamic = "force-dynamic";

/**
 * Begin a purchase.
 *
 * Both payment methods enter here and the response says which road was taken:
 * a points purchase comes back already FULFILLED, a rupiah one comes back
 * PENDING with a Snap token for the browser to open.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    requireStoreEnabled();
    const parsed = storeCheckoutSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ checkout: await startCheckout({ userId: user.id, ...parsed.data }) }, 201);
  } catch (error) {
    return arenaError(error);
  }
}
