import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena";
import { claimRedemption, listUserRedemptions } from "@/server/rewards/redemption-service";

export const dynamic = "force-dynamic";
const claimSchema = z.object({ slug: z.string().trim().min(1).max(64), retryOf: z.string().uuid().optional() });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  try {
    return arenaData({ redemptions: await listUserRedemptions(user.id) });
  } catch (error) {
    return arenaError(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    const parsed = claimSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ taken: await claimRedemption({ userId: user.id, ...parsed.data }) }, 201);
  } catch (error) {
    return arenaError(error);
  }
}
