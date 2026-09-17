import "server-only";
import { ArenaDomainError } from "@/server/arena/errors";

/**
 * Shop configuration.
 *
 * The flag mirrors `isCvScannerEnabled()`: one variable hides the navigation
 * and closes the API, so the shop cannot be half-launched into a visible link
 * over a dead endpoint. It is deliberately `NEXT_PUBLIC_` because the navbar is
 * rendered on the client and must reach the same answer as the route handlers.
 */
export function isStoreEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STORE_ENABLED === "true";
}

/** Route-handler guard. Browsing a closed shop is as unavailable as buying in one. */
export function requireStoreEnabled(): void {
  if (!isStoreEnabled()) {
    throw new ArenaDomainError("FEATURE_CLOSED", "Toko produk digital belum dibuka.");
  }
}

export interface MidtransConfig {
  serverKey: string;
  clientKey: string;
  /** Sandbox until the merchant account is verified; the two never share keys. */
  environment: "sandbox" | "production";
  apiBaseUrl: string;
  appOrigin: string;
}

/**
 * Read the Midtrans credentials, or explain precisely what is missing.
 *
 * This throws rather than returning null so that a rupiah checkout fails loudly
 * at the moment it is attempted. The points path never calls it, which is what
 * lets the shop sell to participants before the merchant account exists.
 */
export function getMidtransConfig(): MidtransConfig {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY?.trim();
  if (!serverKey || !clientKey) {
    throw new ArenaDomainError("PAYMENT_METHOD_UNAVAILABLE", "Pembayaran Rupiah belum dikonfigurasi. Gunakan poin atau hubungi admin.");
  }
  /*
   * The environment is read, never guessed from the key. Midtrans used to
   * prefix sandbox keys with "SB-", but keys issued since no longer carry it —
   * the Sekolah Karir merchant's sandbox pair is plain "Mid-server-…" — so a
   * prefix check refuses a correct configuration. A wrong pairing still fails
   * at the first Snap call with Midtrans' own 401 message, which is logged.
   * Unset means sandbox: a missing value must fail a test payment, never charge
   * real money against half-set keys.
   */
  const environment = process.env.MIDTRANS_ENVIRONMENT?.trim() === "production" ? "production" : "sandbox";
  return {
    serverKey,
    clientKey,
    environment,
    apiBaseUrl: environment === "production" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com",
    appOrigin: (process.env.ARENA_ORIGIN ?? "https://arena.sekolahkarir.id").replace(/\/$/, ""),
  };
}

/** True when a rupiah price can actually be charged; the UI hides the option otherwise. */
export function isRupiahCheckoutConfigured(): boolean {
  try {
    getMidtransConfig();
    return true;
  } catch {
    return false;
  }
}

/** How long a pending rupiah order stays payable before it is written off. */
export const STORE_ORDER_TTL_MINUTES = 60;
