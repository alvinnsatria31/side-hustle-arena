import "server-only";
import { and, desc, eq, gt, ilike, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { catalog, inventoryPeriods, redemptions, reviews, submissions, submissionVersions, users, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";

type Db = ReturnType<typeof getDb>;
export const listQuery = z.object({
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(200).default(""),
});
type Query = z.infer<typeof listQuery>;

export async function listAdminUsers(query: Query, db: Db = getDb()) {
  const search = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
  return db.select({ id: users.id, authSubject: users.authSubject, name: users.displayNameCache, email: users.emailCache, status: users.status })
    .from(users).where(query.q ? or(ilike(users.authSubject, search), ilike(users.displayNameCache, search), ilike(users.emailCache, search)) : undefined)
    .orderBy(desc(users.createdAt), users.id).limit(query.limit).offset(query.offset);
}

export async function setAdminUserStatus(input: { userId: string; status: "ACTIVE" | "SUSPENDED"; reason: string; actorSubject: string; db?: Db }) {
  if (!input.reason.trim() || !input.actorSubject.trim()) throw new ArenaDomainError("VALIDATION_ERROR", "Actor and reason are required.");
  return (input.db ?? getDb()).transaction(async tx => {
    const [user] = await tx.select().from(users).where(eq(users.id, input.userId)).for("update");
    if (!user) throw new ArenaDomainError("VALIDATION_ERROR", "User not found.");
    if (user.authSubject === input.actorSubject && input.status === "SUSPENDED") throw new ArenaDomainError("VALIDATION_ERROR", "You cannot suspend your own account.");
    await tx.update(users).set({ status: input.status, updatedAt: new Date() }).where(eq(users.id, input.userId));
    await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "USER_STATUS_SET", entityType: "user", entityId: user.id,
      metadata: { previousStatus: user.status, status: input.status, reason: input.reason } });
    return { userId: user.id, status: input.status };
  });
}

export async function listAdminReviews(query: Query, status?: typeof reviews.$inferSelect.status, db: Db = getDb()) {
  return db.select({ id: reviews.id, versionId: reviews.submissionVersionId, runNumber: reviews.runNumber, status: reviews.status,
    aiScore: reviews.aiScore, finalScore: reviews.finalScore, summary: reviews.summary, model: reviews.reviewModel,
    confidence: reviews.reviewConfidence, weekCode: weeks.weekCode, weekStatus: weeks.status, enrollmentId: submissions.enrollmentId })
    .from(reviews).innerJoin(submissionVersions, eq(submissionVersions.id, reviews.submissionVersionId))
    .innerJoin(submissions, eq(submissions.id, submissionVersions.submissionId)).innerJoin(weeks, eq(weeks.id, submissions.weekId))
    .where(and(status ? eq(reviews.status, status) : undefined,
      sql`not exists (select 1 from arena.reviews newer where newer.submission_version_id = ${reviews.submissionVersionId} and newer.run_number > ${reviews.runNumber})`))
    .orderBy(desc(reviews.createdAt), reviews.id).limit(query.limit).offset(query.offset);
}

export async function listAdminWeeks(query: Query, db: Db = getDb()) {
  return db.select().from(weeks).orderBy(desc(weeks.opensAt), weeks.id).limit(query.limit).offset(query.offset);
}

export async function listAdminRedemptions(query: Query, status?: typeof redemptions.$inferSelect.status, db: Db = getDb()) {
  return db.select({ id: redemptions.id, userId: redemptions.userId, subject: users.authSubject, name: users.displayNameCache,
    reward: catalog.title, pointsSpent: redemptions.pointsSpent, status: redemptions.status,
    redeemedAt: redemptions.redeemedAt, reference: redemptions.fulfillmentReference })
    .from(redemptions).innerJoin(users, eq(users.id, redemptions.userId)).innerJoin(catalog, eq(catalog.id, redemptions.rewardId))
    .where(status ? eq(redemptions.status, status) : undefined)
    .orderBy(desc(redemptions.redeemedAt), redemptions.id).limit(query.limit).offset(query.offset);
}

export async function listAdminInventory(query: Query, db: Db = getDb()) {
  const rewards = await db.select().from(catalog).orderBy(catalog.title, catalog.id).limit(query.limit).offset(query.offset);
  const periods = await db.select().from(inventoryPeriods).orderBy(desc(inventoryPeriods.periodStart)).limit(200);
  return { rewards, periods };
}

export const inventoryMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("catalog"), rewardId: z.string().uuid(), isActive: z.boolean(), reason: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("quantity"), periodId: z.string().uuid(), quantityTotal: z.number().int().min(0).max(2147483647), reason: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("period"), rewardId: z.string().uuid(), periodStart: z.iso.datetime(), periodEnd: z.iso.datetime(), quantityTotal: z.number().int().min(0).max(2147483647), reason: z.string().trim().min(1).max(1000) }),
]);

export async function updateAdminInventory(input: z.infer<typeof inventoryMutation> & { actorSubject: string; db?: Db }) {
  if (!input.actorSubject.trim()) throw new ArenaDomainError("VALIDATION_ERROR", "Actor is required.");
  return (input.db ?? getDb()).transaction(async tx => {
    if (input.action === "quantity") {
      const [period] = await tx.select().from(inventoryPeriods).where(eq(inventoryPeriods.id, input.periodId)).for("update");
      if (!period || input.quantityTotal < period.quantityReserved + period.quantityFulfilled) throw new ArenaDomainError("VALIDATION_ERROR", "Total cannot be lower than reserved plus fulfilled stock.");
      await tx.update(inventoryPeriods).set({ quantityTotal: input.quantityTotal, updatedAt: new Date() }).where(eq(inventoryPeriods.id, period.id));
      await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "REWARD_INVENTORY_SET", entityType: "inventory_period", entityId: period.id,
        metadata: { previousTotal: period.quantityTotal, quantityTotal: input.quantityTotal, reason: input.reason } });
      return { id: period.id };
    }
    const [reward] = await tx.select().from(catalog).where(eq(catalog.id, input.rewardId)).for("update");
    if (!reward) throw new ArenaDomainError("VALIDATION_ERROR", "Reward not found.");
    if (input.action === "catalog") {
      await tx.update(catalog).set({ isActive: input.isActive, updatedAt: new Date() }).where(eq(catalog.id, reward.id));
      await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "REWARD_CATALOG_SET", entityType: "reward", entityId: reward.id,
        metadata: { previousActive: reward.isActive, isActive: input.isActive, reason: input.reason } });
      return { id: reward.id };
    }
    const start = new Date(input.periodStart);
    const end = new Date(input.periodEnd);
    if (reward.inventoryMode !== "LIMITED" || end <= start) throw new ArenaDomainError("VALIDATION_ERROR", "A limited reward and valid date range are required.");
    const overlap = await tx.select({ id: inventoryPeriods.id }).from(inventoryPeriods)
      .where(and(eq(inventoryPeriods.rewardId, reward.id), lt(inventoryPeriods.periodStart, end), gt(inventoryPeriods.periodEnd, start))).limit(1);
    if (overlap.length) throw new ArenaDomainError("VALIDATION_ERROR", "Inventory periods cannot overlap.");
    const [period] = await tx.insert(inventoryPeriods).values({ rewardId: reward.id, periodStart: start, periodEnd: end, quantityTotal: input.quantityTotal }).returning({ id: inventoryPeriods.id });
    await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "REWARD_INVENTORY_CREATED", entityType: "inventory_period", entityId: period.id,
      metadata: { rewardId: reward.id, periodStart: input.periodStart, periodEnd: input.periodEnd, quantityTotal: input.quantityTotal, reason: input.reason } });
    return period;
  });
}
