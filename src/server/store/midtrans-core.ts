import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Midtrans, as pure functions.
 *
 * Nothing here reads the environment, opens a socket or touches the database,
 * which is the point: signature checking and status mapping are where a payment
 * integration is actually wrong or right, and both must be testable without a
 * merchant account. `midtrans.ts` holds the parts that need the world.
 */

/** What a notification means for the order it names. */
export type PaymentOutcome = "PAID" | "PENDING" | "FAILED" | "EXPIRED" | "REFUNDED";

export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string | null;
  payment_type?: string | null;
  transaction_id?: string | null;
  transaction_time?: string | null;
}

/**
 * Midtrans signs `order_id + status_code + gross_amount + server_key` with
 * SHA-512. The server key never leaves this process, so a caller who can
 * reproduce the digest is Midtrans or somebody who already has our secrets.
 */
export function midtransSignature(input: { orderId: string; statusCode: string; grossAmount: string; serverKey: string }): string {
  return createHash("sha512")
    .update(`${input.orderId}${input.statusCode}${input.grossAmount}${input.serverKey}`)
    .digest("hex");
}

/** Constant-time, because a byte-at-a-time comparison leaks the expected digest. */
export function verifyMidtransSignature(notification: MidtransNotification, serverKey: string): boolean {
  const expected = Buffer.from(midtransSignature({
    orderId: notification.order_id,
    statusCode: notification.status_code,
    grossAmount: notification.gross_amount,
    serverKey,
  }));
  const presented = Buffer.from(String(notification.signature_key ?? "").toLowerCase());
  return expected.length === presented.length && timingSafeEqual(expected, presented);
}

/**
 * Translate a transaction status into what we should do about it.
 *
 * `capture` with `fraud_status: challenge` is deliberately PENDING rather than
 * PAID: Midtrans is holding the transaction for a human to accept or deny, and
 * handing over the goods now would mean handing them over on a payment that may
 * still be reversed. An unrecognised status is PENDING too — a status we have
 * never seen is not permission to deliver.
 */
export function paymentOutcome(transactionStatus: string, fraudStatus?: string | null): PaymentOutcome {
  switch (transactionStatus) {
    case "capture":
      return fraudStatus === "accept" ? "PAID" : "PENDING";
    case "settlement":
      return "PAID";
    case "pending":
      return "PENDING";
    case "deny":
    case "cancel":
    case "failure":
      return "FAILED";
    case "expire":
      return "EXPIRED";
    case "refund":
    case "partial_refund":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

/**
 * The dedupe key for a notification.
 *
 * Midtrans re-sends until it gets a 200, and the same fact re-sent carries the
 * same signature — so the digest, scoped by order and status, is precisely
 * "this exact news about this exact order". Two genuinely different events on
 * one order (pending, then settlement) produce different keys and both apply.
 */
export function paymentEventKey(notification: MidtransNotification): string {
  return `midtrans:${notification.order_id}:${notification.transaction_status}:${notification.signature_key}`;
}

/** Midtrans quotes amounts as "150000" or "150000.00"; we keep minor units. */
export function grossAmountToMinor(grossAmount: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(grossAmount)) return null;
  return Math.round(Number(grossAmount) * 100);
}

/**
 * Minor units to the string Midtrans expects.
 *
 * Throws rather than rounds. A price that cannot be charged exactly is a
 * configuration mistake to surface at checkout, not a few rupiah to swallow
 * quietly on every sale — and a mismatch here would make the webhook's amount
 * check reject the payment anyway.
 */
export function minorToGrossAmount(amountMinor: number): number {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor % 100 !== 0) {
    throw new Error("Midtrans charges whole rupiah; amount must be a positive multiple of 100 minor units.");
  }
  return amountMinor / 100;
}

/**
 * Our reference for a payment, minted before Midtrans is called.
 *
 * Midtrans requires it to be unique forever per merchant and at most 50
 * characters, so the order's own UUID carries the uniqueness and the prefix
 * makes a row in their dashboard legible to a human reconciling by hand.
 */
export function buildProviderOrderId(orderId: string): string {
  return `SKA-${orderId}`;
}
