import "server-only";
import { ArenaDomainError } from "@/server/arena/errors";
import { getMidtransConfig } from "./config";
import { minorToGrossAmount, type MidtransNotification } from "./midtrans-core";

/**
 * The half of the Midtrans integration that touches the network.
 *
 * Snap is called over plain `fetch` rather than through the official SDK: the
 * surface we use is one POST, and a dependency that bundles its own HTTP client
 * buys nothing here except another thing to keep current.
 */

export interface SnapTransaction {
  token: string;
  redirectUrl: string;
  clientKey: string;
  environment: "sandbox" | "production";
}

/** Basic auth with the server key as the username and an empty password. */
function authorization(serverKey: string): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export async function createSnapTransaction(input: {
  providerOrderId: string;
  amountMinor: number;
  productTitle: string;
  productSlug: string;
  customerName?: string | null;
  customerEmail?: string | null;
  expiryMinutes: number;
}): Promise<SnapTransaction> {
  const config = getMidtransConfig();
  const grossAmount = minorToGrossAmount(input.amountMinor);

  const response = await fetch(`${config.apiBaseUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authorization(config.serverKey),
    },
    body: JSON.stringify({
      transaction_details: { order_id: input.providerOrderId, gross_amount: grossAmount },
      /*
       * Midtrans rejects the call when the item prices do not add up to
       * gross_amount, so the single line must carry the whole total. It is also
       * what the buyer reads on the payment page and on their bank statement.
       */
      item_details: [{ id: input.productSlug, price: grossAmount, quantity: 1, name: input.productTitle.slice(0, 50) }],
      customer_details: {
        first_name: (input.customerName ?? "Pembeli").slice(0, 50),
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
      },
      /*
       * Snap's own expiry is set alongside the order's `expires_at` so the two
       * agree. Without it Midtrans keeps the payment page alive for 24 hours
       * while we have long since written the order off — and a payment made
       * against a written-off order is a refund somebody has to process by hand.
       */
      expiry: { unit: "minute", duration: input.expiryMinutes },
      callbacks: { finish: `${config.appOrigin}/app/store?order=${encodeURIComponent(input.providerOrderId)}` },
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch((error: unknown) => {
    throw new ArenaDomainError("PAYMENT_PROVIDER_FAILED", "Tidak bisa menghubungi Midtrans. Coba lagi sebentar lagi.", {
      cause: error instanceof Error ? error.message : "unknown",
    });
  });

  const payload = await response.json().catch(() => null) as { token?: string; redirect_url?: string; error_messages?: string[] } | null;
  if (!response.ok || !payload?.token || !payload.redirect_url) {
    /*
     * Midtrans's own wording is kept: "transaction_details.gross_amount is not
     * equal to the sum of item_details" is the difference between a five-minute
     * fix and an afternoon. It reaches the operator through the audit log, never
     * the buyer, whose message stays generic.
     */
    console.error("[store] Snap transaction refused:", response.status, payload?.error_messages ?? payload);
    throw new ArenaDomainError("PAYMENT_PROVIDER_FAILED", "Midtrans menolak permintaan pembayaran. Coba lagi atau hubungi admin.");
  }

  return { token: payload.token, redirectUrl: payload.redirect_url, clientKey: config.clientKey, environment: config.environment };
}

/**
 * Read a notification body without trusting any of it.
 *
 * The signature is verified by the caller; this only establishes that the
 * fields it needs are strings. A body missing `order_id` or `signature_key`
 * cannot be checked at all, so it is rejected before anything else looks at it.
 */
export function parseNotification(body: unknown): MidtransNotification | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : null);
  const orderId = text("order_id");
  const statusCode = text("status_code");
  const grossAmount = text("gross_amount");
  const signatureKey = text("signature_key");
  const transactionStatus = text("transaction_status");
  if (!orderId || !statusCode || !grossAmount || !signatureKey || !transactionStatus) return null;
  return {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signatureKey,
    transaction_status: transactionStatus,
    fraud_status: text("fraud_status"),
    payment_type: text("payment_type"),
    transaction_id: text("transaction_id"),
    transaction_time: text("transaction_time"),
  };
}

/**
 * What of a notification is worth keeping.
 *
 * A subset, not the raw body: enough to reconcile a payment against Midtrans's
 * dashboard by hand, and nothing describing the instrument the buyer paid with.
 */
export function storableNotification(notification: MidtransNotification): Record<string, unknown> {
  return {
    order_id: notification.order_id,
    transaction_id: notification.transaction_id ?? null,
    transaction_status: notification.transaction_status,
    transaction_time: notification.transaction_time ?? null,
    fraud_status: notification.fraud_status ?? null,
    payment_type: notification.payment_type ?? null,
    gross_amount: notification.gross_amount,
    status_code: notification.status_code,
  };
}
