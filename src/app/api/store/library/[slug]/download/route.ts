import { arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena/http";
import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { requireStoreEnabled } from "@/server/store/config";
import { storeSlugSchema } from "@/server/store/schemas";
import { deliverOwnedProduct } from "@/server/store/delivery-service";

export const dynamic = "force-dynamic";


/**
 * Issue the goods.
 *
 * POST, not GET: a signed download URL is minted on each call and the fetch is
 * audited, so this changes state and must not be something a link prefetcher or
 * a cache can trigger on the buyer's behalf.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    requireStoreEnabled();
    const { slug } = await context.params;
    const parsed = storeSlugSchema.safeParse(slug);
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ delivery: await deliverOwnedProduct({ userId: user.id, slug: parsed.data }) });
  } catch (error) {
    return arenaError(error);
  }
}
