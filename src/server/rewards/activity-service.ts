import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog, orders, pointLedger, redemptions, weeks } from "@/server/db/schema";
import { summarizePoints } from "./accounting";

type Db = ReturnType<typeof getDb>;

export type PointActivityKind = "EARNED" | "SPENT" | "RETURNED" | "ADJUSTED" | "REVOKED";

export interface PointActivity {
  id: string;
  amount: number;
  kind: PointActivityKind;
  /** Participant-facing sentence, never the ledger's internal description. */
  label: string;
  /** The week, reward or product the entry concerns, when there is one. */
  subject: string | null;
  createdAt: string;
}

export interface PointSummary {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  /** Ledger entries that added points: the "dari N aktivitas" count. */
  earningEntries: number;
  recent: PointActivity[];
}

/**
 * One participant's wallet: totals plus their latest ledger entries, labelled.
 *
 * The ledger's `description` column is written for operators ("Void enrollment
 * <id>: <reason>", "Reward claim: <slug>") and can carry an admin's private
 * note, so it never reaches the participant. Labels are built from the entry
 * type, and the subject from the row the entry points at.
 */
export async function getPointSummary(userId: string, input: { recent?: number } = {}, db: Db = getDb()): Promise<PointSummary> {
  const ledger = await db.select().from(pointLedger).where(eq(pointLedger.userId, userId)).orderBy(desc(pointLedger.createdAt));
  const totals = summarizePoints(ledger);
  const earningEntries = ledger.filter((entry) => entry.amount > 0 && (entry.entryType === "WEEKLY_RANK" || entry.entryType === "ADMIN_ADJUSTMENT")).length;
  const recentCount = Math.min(Math.max(input.recent ?? 0, 0), 20);
  const latest = ledger.slice(0, recentCount);

  const weekIds = [...new Set(latest.map((entry) => entry.weekId).filter((id): id is string => Boolean(id)))];
  const redemptionIds = latest.filter((entry) => entry.referenceType === "redemption" && entry.referenceId).map((entry) => entry.referenceId!);
  const orderIds = latest.filter((entry) => entry.referenceType === "store_order" && entry.referenceId).map((entry) => entry.referenceId!);

  const [weekRows, rewardRows, orderRows] = await Promise.all([
    weekIds.length ? db.select({ id: weeks.id, weekCode: weeks.weekCode }).from(weeks).where(inArray(weeks.id, weekIds)) : [],
    redemptionIds.length
      ? db.select({ id: redemptions.id, title: catalog.title }).from(redemptions).innerJoin(catalog, eq(redemptions.rewardId, catalog.id)).where(inArray(redemptions.id, redemptionIds))
      : [],
    orderIds.length ? db.select({ id: orders.id, title: orders.productTitle }).from(orders).where(inArray(orders.id, orderIds)) : [],
  ]);
  const weekCode = new Map(weekRows.map((row) => [row.id, row.weekCode]));
  const rewardTitle = new Map(rewardRows.map((row) => [row.id, row.title]));
  const productTitle = new Map(orderRows.map((row) => [row.id, row.title]));

  const recent = latest.map((entry): PointActivity => {
    const week = entry.weekId ? (weekCode.get(entry.weekId) ?? null) : null;
    const reward = entry.referenceId ? (rewardTitle.get(entry.referenceId) ?? null) : null;
    const product = entry.referenceId ? (productTitle.get(entry.referenceId) ?? null) : null;
    const base = { id: entry.id, amount: entry.amount, createdAt: entry.createdAt.toISOString() };
    switch (entry.entryType) {
      case "WEEKLY_RANK":
        return { ...base, kind: "EARNED", label: "Poin peringkat mingguan", subject: week };
      case "REWARD_REDEMPTION":
        return { ...base, kind: "SPENT", label: "Tukar hadiah", subject: reward };
      case "STORE_PURCHASE":
        return { ...base, kind: "SPENT", label: "Tukar di katalog", subject: product };
      case "STORE_REFUND":
        return { ...base, kind: "RETURNED", label: "Poin dikembalikan", subject: product };
      case "ADMIN_REVERSAL":
        return entry.referenceType === "redemption"
          ? { ...base, kind: "RETURNED", label: "Poin dikembalikan", subject: reward }
          : { ...base, kind: "REVOKED", label: "Poin dibatalkan", subject: week };
      default:
        return { ...base, kind: "ADJUSTED", label: "Penyesuaian poin", subject: null };
    }
  });

  return {
    balance: Math.max(0, totals.balance),
    lifetimeEarned: totals.lifetimeEarned,
    lifetimeSpent: totals.lifetimeSpent,
    earningEntries,
    recent,
  };
}
