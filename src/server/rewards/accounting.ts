import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { pointAccounts, pointLedger } from "@/server/db/schema";

export type RewardDb = ReturnType<typeof getDb>;
type LedgerEntry = Pick<typeof pointLedger.$inferSelect, "amount" | "entryType" | "referenceType">;

export function summarizePoints(entries: LedgerEntry[]) {
  let balance = 0;
  let earned = 0;
  let spent = 0;
  for (const entry of entries) {
    balance += entry.amount;
    if (entry.entryType === "REWARD_REDEMPTION" ||
      (entry.entryType === "ADMIN_REVERSAL" && entry.referenceType === "redemption")) {
      spent -= entry.amount;
    } else {
      earned += entry.amount;
    }
  }
  return {
    balance,
    debt: Math.max(0, -balance),
    lifetimeEarned: Math.max(0, earned),
    lifetimeSpent: Math.max(0, spent),
  };
}

/** Requires an open transaction. All ledger writers lock before inserting. */
export async function lockPointAccount(userId: string, db: RewardDb): Promise<void> {
  await db.insert(pointAccounts).values({ userId }).onConflictDoNothing({ target: pointAccounts.userId });
  await db.select().from(pointAccounts).where(eq(pointAccounts.userId, userId)).for("update");
}

/** Pass the parent's transaction; this helper never commits or opens its own. */
export async function reconcilePointAccount(userId: string, db: RewardDb) {
  await lockPointAccount(userId, db);
  const entries = await db.select().from(pointLedger).where(eq(pointLedger.userId, userId));
  const totals = summarizePoints(entries);
  await db.update(pointAccounts).set({
    balance: Math.max(0, totals.balance),
    lifetimeEarned: totals.lifetimeEarned,
    lifetimeSpent: totals.lifetimeSpent,
    updatedAt: new Date(),
  }).where(eq(pointAccounts.userId, userId));
  return totals;
}
