import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog, logs, redemptions } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";
import { acquireDeliveryLease, fulfillRedemption, releaseDeliveryLease, reverseRedemption } from "./redemption-service";

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
 * `MAIN_SITE_VOUCHER_TOKEN`, idempotent on `code`; and
 * `POST {MAIN_SITE_ORIGIN}/api/v1/vouchers/{code}/void` to withdraw a code
 * whose claim was cancelled. Until both variables are set the push reports
 * `pushable: false` instead of throwing, and the claim is left PENDING for an
 * admin to fulfil by hand — nobody is marked as served who wasn't, and nobody
 * loses a valid claim because the main site is not ready.
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

function voucherContract() {
  const origin = process.env.MAIN_SITE_ORIGIN;
  const token = process.env.MAIN_SITE_VOUCHER_TOKEN;
  return origin && token ? { base: `${origin.replace(/\/+$/, "")}/api/v1/vouchers`, token } : null;
}

export async function pushRewardCode(
  redemptionId: string,
  fetcher: typeof fetch = fetch,
  db: Db = getDb(),
): Promise<VoucherPushResult> {
  const redemption = (await db.select().from(redemptions).where(eq(redemptions.id, redemptionId)))[0];
  if (!redemption) return { ok: false, pushable: false, error: "Redemption not found." };
  const sku = (await db.select().from(catalog).where(eq(catalog.id, redemption.rewardId)))[0];
  if (!sku) return { ok: false, pushable: false, error: "Reward SKU not found." };

  const contract = voucherContract();
  if (!contract) {
    return { ok: false, pushable: false, error: "Main-site voucher contract not configured." };
  }
  try {
    const response = await fetcher(contract.base, {
      method: "POST",
      headers: { Authorization: `Bearer ${contract.token}`, "Content-Type": "application/json" },
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

/**
 * Withdraw a code the main site may hold, for a claim that no longer stands.
 *
 * Only a 2xx counts as done. A 404 cannot tell "nothing to void" from "the
 * endpoint does not exist yet", and guessing wrong leaves a free voucher live —
 * so every other answer is left for manual reconciliation and audited as such.
 */
export async function revokeRewardCode(input: { redemptionId: string; reason: string; fetcher?: typeof fetch }): Promise<VoucherPushResult> {
  const contract = voucherContract();
  if (!contract) return { ok: false, pushable: false, error: "Main-site voucher contract not configured." };
  try {
    const response = await (input.fetcher ?? fetch)(`${contract.base}/${encodeURIComponent(voucherCodeFor(input.redemptionId))}/void`, {
      method: "POST",
      headers: { Authorization: `Bearer ${contract.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ external_reference: input.redemptionId, reason: input.reason }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok ? { ok: true, pushable: true } : { ok: false, pushable: true, error: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, pushable: true, error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error" };
  }
}

async function recordRevocation(db: Db, input: {
  redemptionId: string; actorType: "AUTOMATION" | "ADMIN"; actorSubject: string;
  trigger: "DELIVERED_AFTER_CANCELLATION" | "ADMIN_REVERSAL" | "ADMIN_RETRY_VOID"; revoke: VoucherPushResult; detail?: Record<string, unknown>;
}) {
  await writeAudit(db, {
    actorType: input.actorType, actorSubject: input.actorSubject,
    // RECONCILIATION_REQUIRED is what the admin reward queue flags: the code may
    // still be redeemable on the main site while the points are refunded here.
    action: input.revoke.ok ? "REWARD_VOUCHER_VOIDED" : "REWARD_VOUCHER_RECONCILIATION_REQUIRED",
    entityType: "redemption", entityId: input.redemptionId,
    metadata: {
      code: voucherCodeFor(input.redemptionId), trigger: input.trigger, voided: input.revoke.ok,
      voidPushable: input.revoke.pushable, voidError: input.revoke.error ?? null, ...input.detail,
    },
  });
}

export type VoucherDelivery =
  | { status: "NOT_VOUCHER" }
  | { status: "ALREADY_SETTLED"; redemptionStatus: string }
  | { status: "IN_PROGRESS"; code: string }
  | { status: "DELIVERED"; code: string }
  | { status: "MANUAL_REQUIRED"; code: string; reason: string }
  | { status: "REVOKED"; code: string; voided: boolean; reason: string };

/**
 * Deliver a voucher reward: push its code to the main site and, only if that
 * succeeded, mark the claim FULFILLED with the code as the participant's note.
 *
 * Runs after the claim transaction has committed, never inside it: an HTTP
 * call must not hold the point-account lock, and a main site that is down must
 * not roll back a claim the participant already paid points for.
 *
 * The claim sits in PROCESSING for the push (`acquireDeliveryLease`), which is
 * what keeps an admin reversal from refunding points while a code is on its
 * way. If the claim was cancelled anyway — the lease lapsed — a code the main
 * site accepted is voided and the outcome audited. When the push cannot happen,
 * the claim returns to PENDING and the reason is written to the audit log
 * (`REWARD_VOUCHER_PUSH_DEFERRED`), which the admin reward queue reads to flag
 * it for manual fulfilment. Safe to call again: the code is derived from the
 * claim and the main site dedupes on it.
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
  const [take] = await db.select({ rewardId: redemptions.rewardId }).from(redemptions).where(eq(redemptions.id, input.redemptionId));
  if (!take) throw new ArenaDomainError("VALIDATION_ERROR", "Redemption not found.");
  const [sku] = await db.select({ rewardType: catalog.rewardType, title: catalog.title }).from(catalog).where(eq(catalog.id, take.rewardId));
  if (!sku) throw new ArenaDomainError("VALIDATION_ERROR", "Reward SKU not found.");
  if (!isVoucherReward(sku.rewardType)) return { status: "NOT_VOUCHER" };

  const code = voucherCodeFor(input.redemptionId);
  const lease = await acquireDeliveryLease({ redemptionId: input.redemptionId, db });
  if (!lease.acquired) {
    return lease.reason === "IN_PROGRESS"
      ? { status: "IN_PROGRESS", code }
      : { status: "ALREADY_SETTLED", redemptionStatus: lease.redemptionStatus };
  }

  const push = await pushRewardCode(input.redemptionId, input.fetcher, db);
  let reason: string;
  if (push.ok) {
    try {
      await fulfillRedemption({
        redemptionId: input.redemptionId, actorSubject, actorType, verification: "MAIN_SITE_VOUCHER_PUSHED",
        reference: voucherDeliveryNote(code, sku.title, process.env.MAIN_SITE_ORIGIN), db,
      });
      return { status: "DELIVERED", code };
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      const [after] = await db.select({ status: redemptions.status }).from(redemptions).where(eq(redemptions.id, input.redemptionId));
      if (after?.status === "FULFILLED") return { status: "ALREADY_SETTLED", redemptionStatus: after.status };
      if (after && after.status !== "PENDING" && after.status !== "PROCESSING") {
        // Cancelled while the code was on its way: the points are back with the
        // participant, so the code must not stay redeemable.
        const revoke = await revokeRewardCode({ redemptionId: input.redemptionId, reason: `Claim ${after.status} before delivery completed.`, fetcher: input.fetcher });
        await recordRevocation(db, {
          redemptionId: input.redemptionId, actorType, actorSubject, trigger: "DELIVERED_AFTER_CANCELLATION", revoke,
          detail: { redemptionStatus: after.status, fulfillError: failure },
        });
        return {
          status: "REVOKED", code, voided: revoke.ok,
          reason: revoke.ok
            ? "Klaim sudah dibatalkan saat kode dikirim; kode ditarik kembali dari website utama."
            : `Klaim sudah dibatalkan saat kode dikirim, dan kode belum berhasil ditarik (${revoke.error ?? "tanpa keterangan"}). Perlu rekonsiliasi manual.`,
        };
      }
      reason = `Kode sudah diterima website utama, tetapi klaim gagal ditandai selesai: ${failure}`;
    }
  } else {
    reason = push.pushable
      ? `Website utama menolak atau tidak bisa dihubungi (${push.error ?? "tanpa keterangan"}).`
      : "Kontrak voucher website utama belum dikonfigurasi (MAIN_SITE_ORIGIN / MAIN_SITE_VOUCHER_TOKEN).";
  }
  await releaseDeliveryLease({ redemptionId: input.redemptionId, leaseToken: lease.leaseToken, db });
  await writeAudit(db, {
    actorType, actorSubject, action: "REWARD_VOUCHER_PUSH_DEFERRED", entityType: "redemption", entityId: input.redemptionId,
    metadata: { code, pushable: push.pushable, pushed: push.ok, error: push.error ?? null, reason, fulfillment: "MANUAL_REQUIRED" },
  });
  return { status: "MANUAL_REQUIRED", code, reason };
}

/**
 * Admin reversal for any claim, voiding the voucher code where one may exist.
 *
 * A voucher claim cancelled before fulfilment may still have a code on the main
 * site if a push was ever attempted — a timed-out push can have landed — so the
 * code is voided and the outcome audited. A claim never pushed makes no call. A
 * fulfilled claim is left alone: its reversal policy refunds points and keeps
 * what was handed over.
 */
export async function reverseRedemptionAndRevokeVoucher(input: {
  redemptionId: string; actorSubject: string; reason: string;
  fulfilledPolicy?: "REFUND_POINTS_KEEP_FULFILLED_STOCK"; fetcher?: typeof fetch; db?: Db;
}) {
  const db = input.db ?? getDb();
  const [before] = await db.select({ status: redemptions.status, rewardId: redemptions.rewardId }).from(redemptions).where(eq(redemptions.id, input.redemptionId));
  const reversed = await reverseRedemption({ redemptionId: input.redemptionId, actorSubject: input.actorSubject, reason: input.reason, fulfilledPolicy: input.fulfilledPolicy, db });
  if (!before || (before.status !== "PENDING" && before.status !== "PROCESSING")) return { reversed, voucher: null };
  const [sku] = await db.select({ rewardType: catalog.rewardType }).from(catalog).where(eq(catalog.id, before.rewardId));
  if (!sku || !isVoucherReward(sku.rewardType)) return { reversed, voucher: null };

  const code = voucherCodeFor(input.redemptionId);
  const attempts = await db.select({ metadata: logs.metadata }).from(logs).where(and(
    eq(logs.entityType, "redemption"), eq(logs.entityId, input.redemptionId), eq(logs.action, "REWARD_VOUCHER_PUSH_DEFERRED"),
  ));
  const pushAttempted = before.status === "PROCESSING"
    || attempts.some((row) => (row.metadata as { pushable?: unknown } | null)?.pushable === true);
  if (!pushAttempted) return { reversed, voucher: { code, voidAttempted: false, voided: false } };

  const revoke = await revokeRewardCode({ redemptionId: input.redemptionId, reason: input.reason, fetcher: input.fetcher });
  await recordRevocation(db, { redemptionId: input.redemptionId, actorType: "ADMIN", actorSubject: input.actorSubject, trigger: "ADMIN_REVERSAL", revoke });
  return { reversed, voucher: { code, voidAttempted: true, voided: revoke.ok } };
}

export async function retryVoucherVoid(input: {
  redemptionId: string; actorSubject: string; fetcher?: typeof fetch; db?: Db;
}) {
  const db = input.db ?? getDb();
  const [take] = await db.select({ status: redemptions.status, rewardId: redemptions.rewardId }).from(redemptions).where(eq(redemptions.id, input.redemptionId));
  if (!take || take.status !== "ADMIN_REVERSED") throw new ArenaDomainError("VALIDATION_ERROR", "Only a reversed voucher claim can retry voiding.");
  const [sku] = await db.select({ rewardType: catalog.rewardType }).from(catalog).where(eq(catalog.id, take.rewardId));
  if (!sku || !isVoucherReward(sku.rewardType)) throw new ArenaDomainError("VALIDATION_ERROR", "This reward is not a voucher.");

  const [required] = await db.select({ id: logs.id, createdAt: logs.createdAt }).from(logs).where(and(
    eq(logs.entityType, "redemption"), eq(logs.entityId, input.redemptionId), eq(logs.action, "REWARD_VOUCHER_RECONCILIATION_REQUIRED"),
  )).orderBy(desc(logs.createdAt)).limit(1);
  const [resolved] = await db.select({ createdAt: logs.createdAt }).from(logs).where(and(
    eq(logs.entityType, "redemption"), eq(logs.entityId, input.redemptionId), eq(logs.action, "REWARD_VOUCHER_VOIDED"),
  )).orderBy(desc(logs.createdAt)).limit(1);
  if (!required || (resolved && resolved.createdAt >= required.createdAt)) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Voucher reconciliation is already resolved or was never requested.");
  }

  const revoke = await revokeRewardCode({ redemptionId: input.redemptionId, reason: "Admin retry for unresolved voucher reconciliation.", fetcher: input.fetcher });
  await recordRevocation(db, {
    redemptionId: input.redemptionId, actorType: "ADMIN", actorSubject: input.actorSubject,
    trigger: "ADMIN_RETRY_VOID", revoke, detail: { resolvesAuditLogId: required.id },
  });
  return { code: voucherCodeFor(input.redemptionId), voided: revoke.ok, error: revoke.error ?? null };
}
