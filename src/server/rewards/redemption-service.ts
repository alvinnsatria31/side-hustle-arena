import "server-only";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog, inventoryPeriods, pointLedger, redemptions } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { notify } from "@/server/notifications/service";
import { writeAudit } from "@/server/reviews/audit";
import { lockPointAccount, reconcilePointAccount, type RewardDb } from "./accounting";

export { lockPointAccount, reconcilePointAccount } from "./accounting";
type Redemption = typeof redemptions.$inferSelect;
const activeStatuses = new Set(["PENDING", "PROCESSING", "FULFILLED"]);

function invalid(message: string): never {
  throw new ArenaDomainError("VALIDATION_ERROR", message);
}

function required(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 1000) {
    invalid(`${name} is required (1-1000 characters).`);
  }
  return value.trim();
}

async function funding(take: Redemption, db: RewardDb) {
  const entries = await db.select().from(pointLedger).where(and(
    eq(pointLedger.userId, take.userId),
    eq(pointLedger.referenceType, "redemption"),
    eq(pointLedger.referenceId, take.id),
  ));
  const debit = entries.find((entry) => entry.idempotencyKey === `redemption:${take.id}:debit`);
  const refund = entries.find((entry) => entry.idempotencyKey === `redemption:${take.id}:refund`);
  const net = entries.reduce((sum, entry) => sum + entry.amount, 0);
  if (entries.length === 0) return { funded: false, refunded: false };
  if (!debit || debit.amount !== -take.pointsSpent || debit.entryType !== "REWARD_REDEMPTION" ||
      (refund && (refund.amount !== take.pointsSpent || refund.entryType !== "ADMIN_REVERSAL")) ||
      entries.length !== (refund ? 2 : 1) || net !== (refund ? 0 : -take.pointsSpent)) {
    invalid("Redemption ledger is inconsistent; manual accounting investigation required.");
  }
  return { funded: true, refunded: Boolean(refund) };
}

async function requireFunded(take: Redemption, db: RewardDb) {
  const state = await funding(take, db);
  if (!state.funded || state.refunded) invalid("Unfunded legacy or refunded redemption cannot be fulfilled. Reverse it and submit a new claim.");
}

async function lockedRedemption(id: string, db: RewardDb) {
  // Discover the immutable owner, then follow the same account -> redemption -> stock lock order.
  const [owner] = await db.select().from(redemptions).where(eq(redemptions.id, id));
  if (!owner) invalid("Redemption not found.");
  await lockPointAccount(owner.userId, db);
  const [take] = await db.select().from(redemptions).where(eq(redemptions.id, id)).for("update");
  if (!take) invalid("Redemption not found.");
  return take;
}

async function changeReservation(take: Redemption, fulfill: boolean, db: RewardDb) {
  if (!take.inventoryPeriodId) return;
  const [period] = await db.select().from(inventoryPeriods)
    .where(eq(inventoryPeriods.id, take.inventoryPeriodId)).for("update");
  if (!period || period.rewardId !== take.rewardId || period.quantityReserved < 1 ||
      period.quantityReserved + period.quantityFulfilled > period.quantityTotal) {
    invalid("Redemption inventory is inconsistent; manual investigation required.");
  }
  await db.update(inventoryPeriods).set({
    quantityReserved: period.quantityReserved - 1,
    quantityFulfilled: period.quantityFulfilled + (fulfill ? 1 : 0),
    updatedAt: new Date(),
  }).where(eq(inventoryPeriods.id, period.id));
}

export async function claimRedemption(input: {
  userId: string; slug: string; weekId?: string | null; retryOf?: string; db?: RewardDb;
}): Promise<{ redemptionId: string; pointsSpent: number }> {
  const db = input.db ?? getDb();
  return db.transaction(async (tx) => {
    await lockPointAccount(input.userId, tx);
    const [sku] = await tx.select().from(catalog).where(eq(catalog.slug, input.slug)).for("share");
    if (!sku) invalid("Reward ini tidak tersedia.");
    const takes = await tx.select().from(redemptions).where(and(
      eq(redemptions.userId, input.userId), eq(redemptions.rewardId, sku.id),
    )).orderBy(desc(redemptions.redeemedAt));
    const key = `take:${input.userId}:${sku.id}${input.retryOf ? `:retry:${input.retryOf}` : ""}`;
    const duplicate = takes.find((take) => take.idempotencyKey === key);
    if (duplicate) {
      if (!activeStatuses.has(duplicate.status)) invalid("Previous claim ended; use retryOf with its redemption ID for an intentional retry.");
      // Same-claim repeat (double-click, retried POST): refuse, never mint or
      // silently re-issue. Intentional retries go through retryOf explicitly.
      invalid("Reward ini sudah diklaim.");
    }
    const active = takes.find((take) => activeStatuses.has(take.status));
    if (active) {
      await requireFunded(active, tx);
      return { redemptionId: active.id, pointsSpent: active.pointsSpent };
    }
    if (takes.length || input.retryOf) {
      const previous = takes.find((take) => take.id === input.retryOf);
      if (!previous || (previous.status !== "FAILED" && previous.status !== "ADMIN_REVERSED")) {
        invalid("Intentional retry requires retryOf identifying a failed or reversed claim.");
      }
      // FAILED is not proof of a refund or released stock; normalize through admin reversal first.
      for (const take of takes) {
        const state = await funding(take, tx);
        if ((state.funded && !state.refunded) || (take.status === "FAILED" && take.inventoryPeriodId)) {
          invalid("Reverse the failed claim to settle its debit and reservation before retrying.");
        }
      }
    }
    if (!sku.isActive) invalid("Reward ini tidak tersedia.");
    const totals = await reconcilePointAccount(input.userId, tx);
    if (totals.balance < sku.pointsCost) invalid(`Butuh ${sku.pointsCost} poin (saldo ${totals.balance}).`);
    let inventoryPeriodId: string | null = null;
    if (sku.inventoryMode === "LIMITED") {
      const now = new Date();
      const periods = await tx.select().from(inventoryPeriods).where(and(
        eq(inventoryPeriods.rewardId, sku.id), lte(inventoryPeriods.periodStart, now), gt(inventoryPeriods.periodEnd, now),
      )).orderBy(asc(inventoryPeriods.periodEnd), asc(inventoryPeriods.id)).for("update");
      const period = periods.find((row) => row.quantityTotal - row.quantityReserved - row.quantityFulfilled > 0);
      if (!period) invalid("Reward stock is unavailable in the active period.");
      inventoryPeriodId = period.id;
      await tx.update(inventoryPeriods).set({ quantityReserved: period.quantityReserved + 1, updatedAt: now })
        .where(eq(inventoryPeriods.id, period.id));
    }
    const [take] = await tx.insert(redemptions).values({
      userId: input.userId, rewardId: sku.id, inventoryPeriodId,
      pointsSpent: sku.pointsCost, status: "PENDING", idempotencyKey: key,
    }).returning();
    await tx.insert(pointLedger).values({
      userId: input.userId, amount: -sku.pointsCost, entryType: "REWARD_REDEMPTION",
      weekId: input.weekId ?? null, referenceType: "redemption", referenceId: take.id,
      description: `Reward claim: ${sku.slug}`, idempotencyKey: `redemption:${take.id}:debit`,
    });
    await reconcilePointAccount(input.userId, tx);
    await writeAudit(tx, {
      actorType: "USER", actorSubject: input.userId, action: "MILESTONE_TAKEN",
      entityType: "redemption", entityId: take.id,
      metadata: { slug: sku.slug, pointsSpent: take.pointsSpent, inventoryPeriodId, retryOf: input.retryOf ?? null },
    });
    await notify({
      type: "REWARD_REDEEMED", userId: input.userId, weekId: input.weekId ?? null,
      title: `"${sku.title}" diklaim`, body: "Poin telah dipotong. Klaim masuk antrean pemrosesan tim.", actionUrl: "/app/profile",
    }, tx);
    return { redemptionId: take.id, pointsSpent: take.pointsSpent };
  });
}

/** ADMIN-only integration. Reference attests manual verification; no payout is sent. */
export async function fulfillRedemption(input: {
  redemptionId: string; actorSubject: string; reference: string; db?: RewardDb;
}) {
  const actorSubject = required(input.actorSubject, "Actor subject");
  const reference = required(input.reference, "Manually verified payment/delivery reference");
  return (input.db ?? getDb()).transaction(async (tx) => {
    const take = await lockedRedemption(input.redemptionId, tx);
    await requireFunded(take, tx);
    if (take.status === "FULFILLED") {
      if (take.fulfillmentReference !== reference) invalid("Already fulfilled with a different reference.");
      return take;
    }
    if (take.status !== "PENDING" && take.status !== "PROCESSING") invalid("Only pending or processing claims can be fulfilled.");
    const [sku] = await tx.select().from(catalog).where(eq(catalog.id, take.rewardId));
    if (!sku || (sku.inventoryMode === "LIMITED" && !take.inventoryPeriodId)) invalid("Limited reward has no inventory reservation.");
    await changeReservation(take, true, tx);
    const [fulfilled] = await tx.update(redemptions).set({
      status: "FULFILLED", fulfilledAt: new Date(), fulfillmentReference: reference, updatedAt: new Date(),
    }).where(eq(redemptions.id, take.id)).returning();
    await writeAudit(tx, {
      actorType: "ADMIN", actorSubject, action: "REWARD_FULFILLED", entityType: "redemption", entityId: take.id,
      metadata: { reference, verification: "MANUALLY_VERIFIED", payoutSentByService: false },
    });
    await notify({ type: "REWARD_FULFILLED", userId: take.userId, title: "Reward dipenuhi",
      body: "Tim telah memverifikasi pemenuhan reward kamu.", actionUrl: "/app/profile" }, tx);
    return fulfilled;
  });
}

/** Fulfilled reversals need explicit points-only semantics; funds/consumed stock are not recalled. */
export async function reverseRedemption(input: {
  redemptionId: string; actorSubject: string; reason: string; db?: RewardDb;
  fulfilledPolicy?: "REFUND_POINTS_KEEP_FULFILLED_STOCK";
}) {
  const actorSubject = required(input.actorSubject, "Actor subject");
  const reason = required(input.reason, "Reversal reason");
  return (input.db ?? getDb()).transaction(async (tx) => {
    const take = await lockedRedemption(input.redemptionId, tx);
    if (take.status === "ADMIN_REVERSED") return take;
    const wasFulfilled = take.status === "FULFILLED";
    if (wasFulfilled && input.fulfilledPolicy !== "REFUND_POINTS_KEEP_FULFILLED_STOCK") {
      invalid("Fulfilled reward requires explicit REFUND_POINTS_KEEP_FULFILLED_STOCK policy; this does not recall paid funds.");
    }
    const state = await funding(take, tx);
    if (wasFulfilled && !state.funded) invalid("Legacy unfunded fulfilled reward requires manual accounting investigation.");
    if (state.refunded) invalid("Refund exists but status is inconsistent; manual investigation required.");
    if (!wasFulfilled) await changeReservation(take, false, tx);
    if (state.funded) {
      await tx.insert(pointLedger).values({
        userId: take.userId, amount: take.pointsSpent, entryType: "ADMIN_REVERSAL",
        referenceType: "redemption", referenceId: take.id, description: reason,
        idempotencyKey: `redemption:${take.id}:refund`,
      });
    }
    await reconcilePointAccount(take.userId, tx);
    const [reversed] = await tx.update(redemptions).set({ status: "ADMIN_REVERSED", updatedAt: new Date() })
      .where(eq(redemptions.id, take.id)).returning();
    await writeAudit(tx, {
      actorType: "ADMIN", actorSubject, action: "REWARD_REVERSED", entityType: "redemption", entityId: take.id,
      metadata: { reason, previousStatus: take.status, pointsRefunded: state.funded ? take.pointsSpent : 0,
        fulfilledPolicy: wasFulfilled ? input.fulfilledPolicy : null, externalFundsRecalled: false,
        inventoryReleased: Boolean(take.inventoryPeriodId && !wasFulfilled) },
    });
    await notify({ type: "REWARD_REDEEMED", userId: take.userId, title: "Klaim reward dibatalkan admin",
      body: wasFulfilled ? "Poin dikembalikan. Pembayaran sebelumnya tidak ditarik kembali."
        : state.funded ? "Klaim dibatalkan dan poin dikembalikan." : "Klaim lama tanpa pemotongan poin dibatalkan.",
      actionUrl: "/app/profile" }, tx);
    return reversed;
  });
}

export async function listUserRedemptions(userId: string, db: RewardDb = getDb()) {
  return db.select({
    id: redemptions.id, rewardId: redemptions.rewardId, pointsSpent: redemptions.pointsSpent,
    status: redemptions.status, redeemedAt: redemptions.redeemedAt, fulfilledAt: redemptions.fulfilledAt,
  }).from(redemptions).where(eq(redemptions.userId, userId)).orderBy(desc(redemptions.redeemedAt)).limit(100);
}
