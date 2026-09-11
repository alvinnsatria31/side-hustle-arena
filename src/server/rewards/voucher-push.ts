import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog, redemptions } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";
import { fulfillRedemption } from "./redemption-service";

type Db = ReturnType<typeof getDb>;

/**
 * Reward code fulfillment — interface port of the website's `voucher-push.ts`.
 *
 * Why the code has to leave this app at all: masterclass checkout runs on the
 * main site against its own database, and putting this app in the money path
 * would mean an Arena outage stops everyone from paying. So the row crosses
 * once, at mint time, and the buyer's path never leaves the main site.
 *
 * Contract: `POST {MAIN_SITE_ORIGIN}/api/v1/vouchers`, Bearer
 * `MAIN_SITE_VOUCHER_TOKEN`, idempotent on `code`. Until both variables are
 * set the push reports `pushable: false` instead of throwing, and the claim is
 * left PENDING for an admin to fulfil by hand — nobody is marked as served who
 * wasn't, and nobody loses a valid claim because the main site is not ready.
 */

export interface VoucherPushResult {
  ok: boolean;
  pushable: boolean;
  error?: string;
}

/** Rewards whose fulfilment is a code the main site's checkout accepts. */
export const VOUCHER_REWARD_TYPES: ReadonlySet<string> = new Set(["DISCOUNT", "MASTERCLASS"]);

export function isVoucherReward(rewardType: string): boolean {
  return VOUCHER_REWARD_TYPES.has(rewardType);
}

/**
 * The code for one claim: 12 hex characters of its redemption id.
 *
 * The main site dedupes on `code`, so two claims sharing one would silently
 * collapse into a single voucher. Eight characters (32 bits) made that a real
 * possibility at scale; twelve (48 bits) does not, and the code stays short
 * enough to type at checkout. Derived, never stored: a retry of the same claim
 * pushes the same code, which is what makes the push safe to repeat.
 */
export function voucherCodeFor(redemptionId: string): string {
  return `ARENA-${redemptionId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

/** What the participant reads on their profile once the code is live. */
export function voucherDeliveryNote(code: string, rewardTitle: string, origin: string | undefined): string {
  let where = "website Sekolah Karir";
  try {
    if (origin) where = new URL(origin).host;
  } catch {
    // An unparsable origin never reaches here (the push would have failed), but
    // the note must not throw over wording.
  }
  return `Kode voucher: ${code}\nMasukkan kode ini saat checkout di ${where} untuk memakai "${rewardTitle}".`;
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
        code: voucherCodeFor(redemption.id),
        reward_slug: sku.slug,
        reward_name: sku.title,
        reward_type: sku.rewardType,
        points_spent: redemption.pointsSpent,
        issued_at: redemption.redeemedAt.toISOString(),
        // Lets the main site reconcile a voucher back to the claim that paid for it.
        external_reference: redemption.id,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, pushable: true, error: `HTTP ${response.status}` };
    return { ok: true, pushable: true };
  } catch (error) {
    return { ok: false, pushable: true, error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error" };
  }
}

export type VoucherDelivery =
  | { status: "NOT_VOUCHER" }
  | { status: "ALREADY_SETTLED"; redemptionStatus: string }
  | { status: "DELIVERED"; code: string }
  | { status: "MANUAL_REQUIRED"; code: string; reason: string };

/**
 * Deliver a voucher reward: push its code to the main site and, only if that
 * succeeded, mark the claim FULFILLED with the code as the participant's note.
 *
 * Runs after the claim transaction has committed, never inside it: an HTTP
 * call must not hold the point-account lock, and a main site that is down must
 * not roll back a claim the participant already paid points for. When the
 * push cannot happen, the claim stays PENDING and the reason is written to the
 * audit log (`REWARD_VOUCHER_PUSH_DEFERRED`), which is what the admin reward
 * queue reads to flag it for manual fulfilment. Safe to call again: the code is
 * derived from the claim and the main site dedupes on it.
 */
export async function deliverVoucherReward(input: {
  redemptionId: string;
  actorType?: "AUTOMATION" | "ADMIN";
  actorSubject?: string;
  fetcher?: typeof fetch;
  db?: Db;
}): Promise<VoucherDelivery> {
  const db = input.db ?? getDb();
  const actorType = input.actorType ?? "AUTOMATION";
  const actorSubject = input.actorSubject ?? "voucher-push";
  const [row] = await db.select({ status: redemptions.status, rewardType: catalog.rewardType, title: catalog.title })
    .from(redemptions).innerJoin(catalog, eq(catalog.id, redemptions.rewardId))
    .where(eq(redemptions.id, input.redemptionId));
  if (!row) throw new ArenaDomainError("VALIDATION_ERROR", "Redemption not found.");
  if (!isVoucherReward(row.rewardType)) return { status: "NOT_VOUCHER" };
  if (row.status !== "PENDING" && row.status !== "PROCESSING") return { status: "ALREADY_SETTLED", redemptionStatus: row.status };

  const code = voucherCodeFor(input.redemptionId);
  const push = await pushRewardCode(input.redemptionId, input.fetcher, db);
  let reason: string;
  if (push.ok) {
    try {
      await fulfillRedemption({
        redemptionId: input.redemptionId, actorSubject, actorType, verification: "MAIN_SITE_VOUCHER_PUSHED",
        reference: voucherDeliveryNote(code, row.title, process.env.MAIN_SITE_ORIGIN), db,
      });
      return { status: "DELIVERED", code };
    } catch (error) {
      reason = `Kode sudah diterima website utama, tetapi klaim gagal ditandai selesai: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    reason = push.pushable
      ? `Website utama menolak atau tidak bisa dihubungi (${push.error ?? "tanpa keterangan"}).`
      : "Kontrak voucher website utama belum dikonfigurasi (MAIN_SITE_ORIGIN / MAIN_SITE_VOUCHER_TOKEN).";
  }
  await writeAudit(db, {
    actorType, actorSubject, action: "REWARD_VOUCHER_PUSH_DEFERRED", entityType: "redemption", entityId: input.redemptionId,
    metadata: { code, pushable: push.pushable, pushed: push.ok, error: push.error ?? null, reason, fulfillment: "MANUAL_REQUIRED" },
  });
  return { status: "MANUAL_REQUIRED", code, reason };
}
