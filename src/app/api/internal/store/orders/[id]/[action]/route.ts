import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { closeUnpaidOrder, fulfillPaidOrder, refundPointsOrder } from "@/server/store/checkout-service";
import { storeReasonSchema } from "@/server/store/schemas";

export const dynamic = "force-dynamic";

/**
 * Manual intervention on an order.
 *
 * `fulfill` is the escape hatch for a payment that happened at Midtrans but
 * whose notification never reached us. The operator confirms it in the Midtrans
 * dashboard first; the reason they type is what the audit row records, because
 * "an admin marked this paid" is not an answer anybody can check later.
 *
 * `refund` returns points only. Money goes back through Midtrans, which is the
 * only place that can actually move it — a console that claimed otherwise would
 * mark a buyer refunded while their bank disagrees.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "store");
    const { id, action } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    const parsed = storeReasonSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);

    if (action === "fulfill") {
      const done = await fulfillPaidOrder({
        orderId: id,
        actorType: "ADMIN",
        actorSubject,
        providerStatus: `manual:${parsed.data.reason}`.slice(0, 200),
      });
      return arenaData({ done });
    }
    if (action === "refund") {
      await refundPointsOrder({ orderId: id, reason: parsed.data.reason, actorSubject });
      return arenaData({ refunded: true });
    }
    if (action === "cancel") {
      return arenaData(await closeUnpaidOrder({
        orderId: id,
        status: "FAILED",
        reason: parsed.data.reason,
        actorType: "ADMIN",
        actorSubject,
      }));
    }
    return arenaData({ reason: "UNKNOWN_ACTION" }, 404);
  } catch (error) {
    return arenaError(error);
  }
}
