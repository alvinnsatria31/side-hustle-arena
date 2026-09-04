import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog, redemptions } from "@/server/db/schema";

type Db = ReturnType<typeof getDb>;

/**
 * Reward code fulfillment — interface port of the website's `voucher-push.ts`.
 *
 * Why the code has to leave this app at all: masterclass checkout runs on the
 * main site against its own database, and putting this app in the money path
 * would mean an Arena outage stops everyone from paying. So the row crosses
 * once, at mint time, and the buyer's path never leaves the main site.
 *
 * Status: CONTRACT PENDING. The main-site endpoint
 * (`POST {MAIN_SITE_ORIGIN}/api/v1/vouchers`, Bearer `MAIN_SITE_VOUCHER_TOKEN`,
 * idempotent on `code`) is not agreed yet, so this function records intent and
 * reports `pushable: false` instead of throwing. Redemption stays PENDING
 * until fulfillment (Phase 7) — nobody is marked as paid who wasn't.
 */

export interface VoucherPushResult {
  ok: boolean;
  pushable: boolean;
  error?: string;
}

const TIMEOUT_MS = 10_000;

export async function pushRewardCode(
  redemptionId: string,
  fetcher: typeof fetch = fetch,
  db: Db = getDb(),
): Promise<VoucherPushResult> {
  const redemption = (await db.select().from(redemptions).where(eq(redemptions.id, redemptionId)))[0];
  if (!redemption) return { ok: false, pushable: false, error: "Redemption not found." };
  const sku = (await db.select().from(catalog).where(eq(catalog.id, redemption.rewardId)))[0];
  if (!sku) return { ok: false, pushable: false, error: "Reward SKU not found." };

  const origin = process.env.MAIN_SITE_ORIGIN;
  const token = process.env.MAIN_SITE_VOUCHER_TOKEN;
  if (!origin || !token) {
    return { ok: false, pushable: false, error: "Main-site voucher contract not configured." };
  }
  try {
    const response = await fetcher(`${origin.replace(/\/+$/, "")}/api/v1/vouchers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `ARENA-${redemption.id.slice(0, 8).toUpperCase()}`,
        reward_slug: sku.slug,
        reward_name: sku.title,
        points_spent: redemption.pointsSpent,
        issued_at: redemption.redeemedAt.toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, pushable: true, error: `HTTP ${response.status}` };
    return { ok: true, pushable: true };
  } catch (error) {
    return { ok: false, pushable: true, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
