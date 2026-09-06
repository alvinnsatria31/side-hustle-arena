import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog, pointLedger, redemptions } from "@/server/db/schema";
import { summarizePoints } from "./accounting";
import { claimRedemption } from "./redemption-service";

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
 * SKU (or retuning a price) reshapes the ladder with no code change — but the
 * 2,000 pts → USD 20 SKU stays locked per PRD §35.
 */

export type MilestoneState = "locked" | "ready" | "taken";

export interface MilestoneStep {
  slug: string;
  title: string;
  pointsRequired: number;
  state: MilestoneState;
  /** Points still missing. 0 once reached. */
  deficit: number;
  takenAt: string | null;
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
}): MilestoneLadder {
  const steps: MilestoneStep[] = [...input.catalog]
    .sort((a, b) => a.pointsCost - b.pointsCost)
    .map((sku) => {
      const taken = input.takenSlugs.has(sku.slug);
      const reached = input.lifetimePoints >= sku.pointsCost;
      return {
        slug: sku.slug,
        title: sku.title,
        pointsRequired: sku.pointsCost,
        state: (taken ? "taken" : reached ? "ready" : "locked") as MilestoneState,
        deficit: taken || reached ? 0 : sku.pointsCost - input.lifetimePoints,
        takenAt: taken ? (input.takenAt.get(sku.slug) ?? null) : null,
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

const TAKEN_STATUSES = ["PENDING", "PROCESSING", "FULFILLED"] as const;

export async function getMilestoneLadder(userId: string, db: Db = getDb()): Promise<MilestoneLadder> {
  const [lifetimePoints, skus, takes] = await Promise.all([
    getLifetimePoints(userId, db),
    db.select({ id: catalog.id, slug: catalog.slug, title: catalog.title, pointsCost: catalog.pointsCost }).from(catalog).where(eq(catalog.isActive, true)),
    db.select().from(redemptions).where(eq(redemptions.userId, userId)),
  ]);
  const taken = takes.filter((take) => (TAKEN_STATUSES as readonly string[]).includes(take.status));
  const slugById = new Map(skus.map((sku) => [sku.id, sku.slug]));
  const takenAt = new Map<string, string>();
  for (const take of taken) {
    const slug = slugById.get(take.rewardId);
    if (slug && !takenAt.has(slug)) takenAt.set(slug, take.redeemedAt.toISOString());
  }
  return computeLadderState({
    lifetimePoints,
    catalog: skus.map((sku) => ({ slug: sku.slug, title: sku.title, pointsCost: sku.pointsCost })),
    takenSlugs: new Set([...takenAt.keys()]),
    takenAt,
  });
}

/**
 * Claim against spendable ledger balance. The shared service debits points,
 * reserves stock and records the claim atomically.
 */
export async function takeMilestone(
  input: { userId: string; slug: string; weekId?: string | null; retryOf?: string; db?: Db },
): Promise<{ redemptionId: string; pointsSpent: number }> {
  return claimRedemption(input);
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
