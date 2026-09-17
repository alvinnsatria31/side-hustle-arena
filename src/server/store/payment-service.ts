import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { entitlements, orders, paymentEvents } from "@/server/db/schema";
import { writeAudit } from "@/server/reviews/audit";
import { getMidtransConfig } from "./config";
import { closeUnpaidOrder, fulfillPaidOrder } from "./checkout-service";
import { grossAmountToMinor, paymentEventKey, paymentOutcome, verifyMidtransSignature, type MidtransNotification } from "./midtrans-core";
import { parseNotification, storableNotification } from "./midtrans";

type Db = ReturnType<typeof getDb>;

/**
 * The webhook's brain.
 *
 * Everything a payment notification can be, and what each one is allowed to
 * change. Three rules hold the whole thing up:
 *
 *   1. Nothing is believed before its signature is checked.
 *   2. Nothing is acted on twice — the event table is the record of what has
 *      already been applied, not merely of what has arrived.
 *   3. The amount paid must equal the amount billed. A notification that says
 *      otherwise is never fulfilment, whatever its status field claims.
 */

export type NotificationResult =
  | { handled: false; reason: "MALFORMED" | "BAD_SIGNATURE" }
  | { handled: true; outcome: "DUPLICATE" | "UNKNOWN_ORDER" | "AMOUNT_MISMATCH" | "PENDING" | "FULFILLED" | "ALREADY_SETTLED" | "CLOSED" | "REFUNDED" };

/**
 * Take one notification from Midtrans.
 *
 * Returns rather than throws for everything Midtrans can legitimately send,
 * including news we cannot act on: an unrecognised order is answered 200 and
 * recorded, because retrying it forever would not make it recognisable and
 * would bury the real failures under it.
 */
export async function handleMidtransNotification(body: unknown, db: Db = getDb()): Promise<NotificationResult> {
  const notification = parseNotification(body);
  if (!notification) return { handled: false, reason: "MALFORMED" };

  const config = getMidtransConfig();
  if (!verifyMidtransSignature(notification, config.serverKey)) {
    /*
     * Logged, never stored. An unsigned body proves nothing about who sent it,
     * so writing it to the events table would let anybody who can reach the URL
     * fill our database with whatever they like.
     */
    console.warn(`[store] rejected Midtrans notification with bad signature for ${notification.order_id}`);
    return { handled: false, reason: "BAD_SIGNATURE" };
  }

  const [order] = await db.select().from(orders).where(eq(orders.providerOrderId, notification.order_id));
  const event = await recordEvent(notification, order?.id ?? null, db);
  if (!event) return { handled: true, outcome: "DUPLICATE" };

  if (!order) {
    console.warn(`[store] Midtrans notification for unknown order ${notification.order_id}`);
    await markApplied(event.id, db);
    return { handled: true, outcome: "UNKNOWN_ORDER" };
  }

  const paidMinor = grossAmountToMinor(notification.gross_amount);
  if (paidMinor === null || paidMinor !== order.amountIdrMinor) {
    /*
     * The amount is the one field a tampered or misrouted notification cannot
     * fake past the signature, because the signature covers it — so a mismatch
     * here means the notification belongs to a different charge than the order
     * it names. It is recorded and audited, and it never delivers anything.
     */
    await writeAudit(db, {
      actorType: "SYSTEM",
      actorSubject: "midtrans-webhook",
      action: "STORE_PAYMENT_AMOUNT_MISMATCH",
      entityType: "store_order",
      entityId: order.id,
      metadata: { billedMinor: order.amountIdrMinor, paidMinor, grossAmount: notification.gross_amount },
    });
    await markApplied(event.id, db);
    return { handled: true, outcome: "AMOUNT_MISMATCH" };
  }

  const outcome = paymentOutcome(notification.transaction_status, notification.fraud_status);
  const result = await applyOutcome({ order, notification, outcome, db });
  await markApplied(event.id, db);
  return { handled: true, outcome: result };
}

/**
 * Write the event down, or discover it is already written.
 *
 * Returning null means "this exact news has already been applied". A row that
 * exists but was never applied is returned instead of skipped: that is the
 * shape of a delivery that arrived, was recorded, and then crashed before it
 * changed anything — and Midtrans's retry is the one chance to finish it.
 */
async function recordEvent(notification: MidtransNotification, orderId: string | null, db: Db) {
  const eventKey = paymentEventKey(notification);
  const [inserted] = await db.insert(paymentEvents).values({
    orderId,
    provider: "midtrans",
    eventKey,
    providerOrderId: notification.order_id,
    transactionStatus: notification.transaction_status,
    fraudStatus: notification.fraud_status ?? null,
    grossAmountMinor: grossAmountToMinor(notification.gross_amount),
    payload: storableNotification(notification),
  }).onConflictDoNothing({ target: paymentEvents.eventKey }).returning();
  if (inserted) return inserted;

  const [existing] = await db.select().from(paymentEvents).where(eq(paymentEvents.eventKey, eventKey));
  return existing && !existing.appliedAt ? existing : null;
}

async function markApplied(eventId: string, db: Db): Promise<void> {
  await db.update(paymentEvents).set({ appliedAt: new Date() }).where(eq(paymentEvents.id, eventId));
}

async function applyOutcome(input: {
  order: typeof orders.$inferSelect;
  notification: MidtransNotification;
  outcome: ReturnType<typeof paymentOutcome>;
  db: Db;
}): Promise<"PENDING" | "FULFILLED" | "ALREADY_SETTLED" | "CLOSED" | "REFUNDED"> {
  const { order, notification, outcome, db } = input;
  const providerStatus = notification.fraud_status
    ? `${notification.transaction_status}/${notification.fraud_status}`
    : notification.transaction_status;

  if (outcome === "PAID") {
    const settled = await fulfillPaidOrder({
      orderId: order.id,
      actorType: "AUTOMATION",
      actorSubject: "midtrans-webhook",
      providerStatus,
      db,
    });
    return settled.fulfilled ? "FULFILLED" : "ALREADY_SETTLED";
  }

  if (outcome === "PENDING") {
    // Nothing to deliver and nothing to close — only news worth recording, so a
    // challenged transaction can be found by whoever has to accept or deny it.
    await db.update(orders).set({ providerStatus, updatedAt: new Date() }).where(eq(orders.id, order.id));
    return "PENDING";
  }

  if (outcome === "REFUNDED") return refundRupiahOrder({ order, providerStatus, db });

  await closeUnpaidOrder({
    orderId: order.id,
    status: outcome === "EXPIRED" ? "EXPIRED" : "FAILED",
    reason: `Midtrans: ${providerStatus}`,
    actorType: "AUTOMATION",
    actorSubject: "midtrans-webhook",
    providerStatus,
    db,
  });
  return "CLOSED";
}

/**
 * A refund made at Midtrans, reflected here.
 *
 * The money has already gone back — this is not where a refund is initiated,
 * only where its consequence is recorded. What we owe in return is the goods:
 * the grant is withdrawn, or a refunded buyer keeps a product they no longer
 * paid for.
 */
async function refundRupiahOrder(input: {
  order: typeof orders.$inferSelect;
  providerStatus: string;
  db: Db;
}): Promise<"REFUNDED"> {
  const { order, providerStatus, db } = input;
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.update(orders).set({ status: "REFUNDED", providerStatus, updatedAt: now }).where(eq(orders.id, order.id));
    await tx.update(entitlements)
      .set({ revokedAt: now, revokedReason: `REFUNDED: Midtrans ${providerStatus}`, updatedAt: now })
      .where(and(eq(entitlements.orderId, order.id), isNull(entitlements.revokedAt)));
    await writeAudit(tx, {
      actorType: "AUTOMATION",
      actorSubject: "midtrans-webhook",
      action: "STORE_ORDER_REFUNDED",
      entityType: "store_order",
      entityId: order.id,
      metadata: { providerStatus, amountIdrMinor: order.amountIdrMinor },
    });
  });
  return "REFUNDED";
}
