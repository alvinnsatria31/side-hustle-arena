import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena";
import { takeMilestone } from "@/server/rewards/milestones";

export const dynamic = "force-dynamic";

const takeSchema = z.object({ slug: z.string().trim().min(1).max(64) });

/** Claim a reached milestone: creates a PENDING redemption + notice. Fulfillment is Phase 7. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    const parsed = takeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ taken: false, reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ taken: await takeMilestone({ userId: user.id, slug: parsed.data.slug }) }, 201);
  } catch (error) {
    return arenaError(error);
  }
}
