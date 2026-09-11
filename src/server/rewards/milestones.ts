import "server-only";
import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog, inventoryPeriods, pointLedger, redemptions } from "@/server/db/schema";
import { summarizePoints } from "./accounting";
import { claimRedemption } from "./redemption-service";
import { deliverVoucherReward, type VoucherDelivery } from "./voucher-push";

export { lockPointAccount, reconcilePointAccount } from "./accounting";

type Db = ReturnType<typeof getDb>;

/**
 * Milestone ladder — full port of the website's milestone design, re-based on
 * Arena POINTS (PRD §35 catalog) instead of website XP.
 *
 * Core safety property (kept from the website): entitlement is COMPUTED from
 * the point ledger on every read and never stored. A participant's ladder is
 * correct the instant their points change, no matter which code path changed
 * it. The only thing stored is the take: a redemption row proving somebody
 * claimed a milestone. Past events belong in the database; entitlements don't.
 *
 * Ladder steps = ACTIVE catalog SKUs ordered by pointsCost. Activating a new
 * SKU (or retuning a price) reshapes the ladder with no code change. The
 * official ladder (2026-09-11) is six rewards, 300 → 2.700 points, and the
 * most expensive active step is the main reward (CASH REWARD Rp500.000).
 */

export type MilestoneState = "locked" | "ready" | "taken" | "out_of_stock";

export interface MilestoneStep {
  slug: string;
  title: string;
  pointsRequired: number;
  state: MilestoneState;
  /** Points still missing. 0 once reached. */
  deficit: number;
  takenAt: string | null;
  /** LIMITED reward with no unit left in any active inventory period. */
  outOfStock: boolean;
  /**
   * The ended claim a repeat claim has to name, or null for a first claim.
   * claimRedemption refuses a repeat that does not name it, so a "ready" step
   * without this ID offered a button that could only fail.
   */
  retryOf: string | null;
}

export interface MilestoneLadder {
  lifetimePoints: number;
  steps: MilestoneStep[];
  next: MilestoneStep | null;
  takenCount: number;
  readyCount: number;
}

/** Pure core: ladder math with zero I/O, unit-testable. */
export function computeLadderState(input: {
  lifetimePoints: number;
  catalog: Array<{ slug: string; title: string; pointsCost: number }>;
  takenSlugs: Set<string>;
  takenAt: Map<string, string>;
  outOfStockSlugs?: Set<string>;
  retryOf?: Map<string, string>;
}): MilestoneLadder {
  const steps: MilestoneStep[] = [...input.catalog]
    .sort((a, b) => a.pointsCost - b.pointsCost)
    .map((sku) => {
      const taken = input.takenSlugs.has(sku.slug);
      const reached = input.lifetimePoints >= sku.pointsCost;
      const outOfStock = !taken && (input.outOfStockSlugs?.has(sku.slug) ?? false);
      // An unreached reward keeps showing its points gap; the empty shelf is
      // flagged alongside it and takes over once the points are there.
      const state: MilestoneState = taken ? "taken" : !reached ? "locked" : outOfStock ? "out_of_stock" : "ready";
      return {
        slug: sku.slug,
        title: sku.title,
        pointsRequired: sku.pointsCost,
        state,
        deficit: taken || reached ? 0 : sku.pointsCost - input.lifetimePoints,
        takenAt: taken ? (input.takenAt.get(sku.slug) ?? null) : null,
        outOfStock,
        retryOf: taken ? null : (input.retryOf?.get(sku.slug) ?? null),
      };
    });
  return {
    lifetimePoints: input.lifetimePoints,
    steps,
    next: steps.find((step) => step.state === "locked") ?? null,
    takenCount: steps.filter((step) => step.state === "taken").length,
    readyCount: steps.filter((step) => step.state === "ready").length,
  };
}

export async function getLifetimePoints(userId: string, db: Db = getDb()): Promise<number> {
  const rows = await db.select().from(pointLedger).where(eq(pointLedger.userId, userId));
  return summarizePoints(rows).lifetimeEarned;
}

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["PENDING", "PROCESSING", "FULFILLED"]);

type TakeRow = Pick<typeof redemptions.$inferSelect, "id" | "status" | "idempotencyKey" | "inventoryPeriodId" | "redeemedAt">;

/**
 * What one participant's claims of one reward allow next — the rules
 * claimRedemption enforces, read without its locks, so the ladder never offers
 * a claim the service will refuse:
 *
 * - an active claim (pending, processing, fulfilled) holds the reward;
 * - an ended claim still carrying its debit, or a failed one still holding a
 *   stock reservation, blocks every retry until an admin reverses it, so it
 *   holds the reward too instead of showing a button that can only error;
 * - otherwise a retry must name the newest ended claim nobody has retried from.
 *   An older one already has a retry keyed to it, and naming it again collides
 *   with that key — which is also why "newest" is not decided by timestamp alone.
 *
 * `ledgerKeys` are the participant's ledger idempotency keys; the service
 * writes `redemption:<id>:debit` and `redemption:<id>:refund` per claim.
 */
export function classifyRewardTakes(takes: TakeRow[], ledgerKeys: ReadonlySet<string>): { heldAt: Date | null; retryOf: string | null } {
  const newestFirst = [...takes].sort((a, b) => b.redeemedAt.getTime() - a.redeemedAt.getTime());
  const active = newestFirst.find((take) => ACTIVE_STATUSES.has(take.status));
  if (active) return { heldAt: active.redeemedAt, retryOf: null };
  const unsettled = newestFirst.find((take) =>
    (ledgerKeys.has(`redemption:${take.id}:debit`) && !ledgerKeys.has(`redemption:${take.id}:refund`))
    || (take.status === "FAILED" && take.inventoryPeriodId !== null));
  if (unsettled) return { heldAt: unsettled.redeemedAt, retryOf: null };
  const retried = new Set(takes.map((take) => /:retry:(.+)$/.exec(take.idempotencyKey)?.[1]));
  return { heldAt: null, retryOf: newestFirst.find((take) => !retried.has(take.id))?.id ?? null };
}

export async function getMilestoneLadder(userId: string, db: Db = getDb(), now = new Date()): Promise<MilestoneLadder> {
  const [ledger, skus, takes] = await Promise.all([
    db.select().from(pointLedger).where(eq(pointLedger.userId, userId)),
    db.select({ id: catalog.id, slug: catalog.slug, title: catalog.title, pointsCost: catalog.pointsCost, inventoryMode: catalog.inventoryMode })
      .from(catalog).where(eq(catalog.isActive, true)),
    db.select().from(redemptions).where(eq(redemptions.userId, userId)),
  ]);
  const ledgerKeys = new Set(ledger.map((entry) => entry.idempotencyKey));
  const takenAt = new Map<string, string>();
  const retryOf = new Map<string, string>();
  for (const sku of skus) {
    const claims = classifyRewardTakes(takes.filter((take) => take.rewardId === sku.id), ledgerKeys);
    if (claims.heldAt) takenAt.set(sku.slug, claims.heldAt.toISOString());
    if (claims.retryOf) retryOf.set(sku.slug, claims.retryOf);
  }
  return computeLadderState({
    lifetimePoints: summarizePoints(ledger).lifetimeEarned,
    catalog: skus.map((sku) => ({ slug: sku.slug, title: sku.title, pointsCost: sku.pointsCost })),
    takenSlugs: new Set([...takenAt.keys()]),
    takenAt,
    outOfStockSlugs: await outOfStockSlugs(db, skus, now),
    retryOf,
  });
}

// Same rule the claim applies inside its transaction: some active period still
// has a free unit. The claim re-checks under lock, so a unit taken between this
// read and the click is refused there rather than oversold.
async function outOfStockSlugs(db: Db, skus: Array<{ id: string; slug: string; inventoryMode: string }>, now: Date) {
  const limited = skus.filter((sku) => sku.inventoryMode === "LIMITED");
  if (!limited.length) return new Set<string>();
  const periods = await db.select({
    rewardId: inventoryPeriods.rewardId, total: inventoryPeriods.quantityTotal,
    reserved: inventoryPeriods.quantityReserved, fulfilled: inventoryPeriods.quantityFulfilled,
  }).from(inventoryPeriods).where(and(
    inArray(inventoryPeriods.rewardId, limited.map((sku) => sku.id)),
    lte(inventoryPeriods.periodStart, now),
    gt(inventoryPeriods.periodEnd, now),
  ));
  const available = new Set(periods.filter((period) => period.total - period.reserved - period.fulfilled > 0).map((period) => period.rewardId));
  return new Set(limited.filter((sku) => !available.has(sku.id)).map((sku) => sku.slug));
}

/**
 * Claim against spendable ledger balance. The shared service debits points,
 * reserves stock and records the claim atomically.
 *
 * A voucher reward (DISCOUNT / MASTERCLASS) is then delivered: its code is
 * pushed to the main site and the claim fulfilled with it. That happens after
 * the claim has committed and can never undo it — a main site that is not
 * ready leaves the claim PENDING for manual fulfilment, and an unexpected
 * failure in delivery is reported as `delivery: null`, not as a failed claim.
 */
export async function takeMilestone(
  input: { userId: string; slug: string; weekId?: string | null; retryOf?: string; db?: Db },
): Promise<{ redemptionId: string; pointsSpent: number; delivery: VoucherDelivery | null }> {
  const taken = await claimRedemption(input);
  let delivery: VoucherDelivery | null = null;
  try {
    delivery = await deliverVoucherReward({ redemptionId: taken.redemptionId, db: input.db });
  } catch (error) {
    console.error("[rewards] voucher delivery failed after a committed claim", taken.redemptionId, error instanceof Error ? error.message : error);
  }
  return { ...taken, delivery };
}

/**
 * Newly-crossed thresholds for one award, computed from ledger math
 * (before/after), never from stored flags. Called by finalize right after a
 * points insert that actually landed (idempotent re-finalize awards nothing,
 * so it also notifies nothing).
 */
export function crossedThresholds(previousLifetime: number, awarded: number, costs: number[]): number[] {
  const after = previousLifetime + awarded;
  return costs.filter((cost) => previousLifetime < cost && cost <= after).sort((a, b) => a - b);
}
