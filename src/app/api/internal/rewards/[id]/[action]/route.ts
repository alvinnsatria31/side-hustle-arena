import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { fulfillRedemption } from "@/server/rewards/redemption-service";
import { deliverVoucherReward, retryVoucherVoid, reverseRedemptionAndRevokeVoucher } from "@/server/rewards/voucher-push";

const fulfillSchema = z.object({ reference: z.string().trim().min(1).max(1000) });
const reverseSchema = z.object({ reason: z.string().trim().min(1).max(1000), fulfilledPolicy: z.literal("REFUND_POINTS_KEEP_FULFILLED_STOCK").optional() });
export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "rewards");
    const { id, action } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    const body = await request.json().catch(() => null);
    if (action === "fulfill") {
      const parsed = fulfillSchema.safeParse(body);
      if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
      return arenaData({ done: await fulfillRedemption({ ...parsed.data, redemptionId: id, actorSubject }) });
    }
    if (action === "push-voucher") {
      // Retry the main-site push for a voucher claim left for manual fulfilment.
      return arenaData({ done: await deliverVoucherReward({ redemptionId: id, actorType: "ADMIN", actorSubject }) });
    }
    if (action === "retry-void") {
      return arenaData({ done: await retryVoucherVoid({ redemptionId: id, actorSubject }) });
    }
    if (action === "reverse") {
      const parsed = reverseSchema.safeParse(body);
      if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
      // A cancelled voucher claim also has its code voided on the main site where one may exist.
      const result = await reverseRedemptionAndRevokeVoucher({ ...parsed.data, redemptionId: id, actorSubject });
      return arenaData({ done: result.reversed, voucher: result.voucher });
    }
    return arenaData({ reason: "UNKNOWN_ACTION" }, 404);
  } catch (error) { return arenaError(error); }
}
