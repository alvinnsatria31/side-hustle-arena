import "server-only";
import { and, desc, eq, gt, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { catalog, inventoryPeriods, jobSources, logs, redemptions, reviews, users, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";
import { isVoucherReward, voucherCodeFor } from "@/server/rewards/voucher-push";
import { fieldMapSchema, httpJsonSourceConfigSchema } from "@/server/career/jobs/contract";
import { assertFeedTransportAllowed } from "@/server/career/jobs/sync-service";

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

type AdminReviewSqlRow = {
  id: string | null; version_id: string; run_number: number | null; status: string;
  ai_score: string | null; final_score: string | null; summary: string | null; review_model: string | null;
  review_confidence: string | null; week_code: string; week_status: string; enrollment_id: string;
  job_status: string | null; last_error_code: string | null; last_error_message: string | null;
};

// Rooted at the version: a first review that failed before writing a row exists only as a FAILED job.
export async function listAdminReviews(query: Query, status?: typeof reviews.$inferSelect.status, db: Db = getDb()) {
  const filter = status ?? null;
  const rows = await db.execute(sql`
    select latest.id, v.id as version_id, latest.run_number, coalesce(latest.status::text, 'FAILED') as status,
      latest.ai_score, latest.final_score, latest.summary, latest.review_model, latest.review_confidence,
      w.week_code, w.status::text as week_status, s.enrollment_id,
      j.status::text as job_status, j.last_error_code, j.last_error_message
    from arena.submission_versions v
    join arena.submissions s on s.id = v.submission_id
    join arena.weeks w on w.id = s.week_id
    left join arena.review_jobs j on j.submission_version_id = v.id
    left join lateral (
      select r.* from arena.reviews r where r.submission_version_id = v.id order by r.run_number desc limit 1
    ) latest on true
    where (latest.id is not null or j.status = 'FAILED' or v.review_status = 'FAILED')
      and (${filter}::text is null or coalesce(latest.status::text, 'FAILED') = ${filter}::text
        or (${filter}::text = 'FAILED' and j.status = 'FAILED'))
    order by coalesce(latest.created_at, j.updated_at, v.submitted_at) desc, v.id
    limit ${query.limit} offset ${query.offset}`);
  return (rows as unknown as AdminReviewSqlRow[]).map((row) => ({
    id: row.id, versionId: row.version_id, runNumber: row.run_number,
    status: row.status as typeof reviews.$inferSelect.status,
    aiScore: row.ai_score, finalScore: row.final_score, summary: row.summary, model: row.review_model,
    confidence: row.review_confidence, weekCode: row.week_code,
    weekStatus: row.week_status as typeof weeks.$inferSelect.status, enrollmentId: row.enrollment_id,
    jobStatus: row.job_status,
    jobError: row.job_status === "FAILED" ? [row.last_error_code, row.last_error_message].filter(Boolean).join(": ") || null : null,
  }));
}

export async function listAdminWeeks(query: Query, db: Db = getDb()) {
  return db.select().from(weeks).orderBy(desc(weeks.opensAt), weeks.id).limit(query.limit).offset(query.offset);
}

export async function listAdminRedemptions(query: Query, status?: typeof redemptions.$inferSelect.status, db: Db = getDb()) {
  const rows = await db.select({ id: redemptions.id, userId: redemptions.userId, subject: users.authSubject, name: users.displayNameCache,
    reward: catalog.title, rewardType: catalog.rewardType, pointsSpent: redemptions.pointsSpent, status: redemptions.status,
    redeemedAt: redemptions.redeemedAt, reference: redemptions.fulfillmentReference })
    .from(redemptions).innerJoin(users, eq(users.id, redemptions.userId)).innerJoin(catalog, eq(catalog.id, redemptions.rewardId))
    .where(status ? eq(redemptions.status, status) : undefined)
    .orderBy(desc(redemptions.redeemedAt), redemptions.id).limit(query.limit).offset(query.offset);
  // A voucher claim still open after its automatic push was deferred needs a
  // human: the latest deferral says why, so the queue can flag it.
  const openVouchers = rows.filter((row) => isVoucherReward(row.rewardType) && (row.status === "PENDING" || row.status === "PROCESSING")).map((row) => row.id);
  const deferrals = openVouchers.length
    ? await db.select({ entityId: logs.entityId, metadata: logs.metadata, createdAt: logs.createdAt }).from(logs)
      .where(and(eq(logs.action, "REWARD_VOUCHER_PUSH_DEFERRED"), inArray(logs.entityId, openVouchers)))
      .orderBy(desc(logs.createdAt))
    : [];
  const latest = new Map<string, { deferredAt: Date; reason: string | null }>();
  for (const row of deferrals) {
    if (!row.entityId || latest.has(row.entityId)) continue;
    latest.set(row.entityId, { deferredAt: row.createdAt, reason: (row.metadata as { reason?: string } | null)?.reason ?? null });
  }
  // A cancelled voucher claim whose code could not be voided may still be
  // redeemable on the main site with the points already refunded here.
  const reversedVouchers = rows.filter((row) => isVoucherReward(row.rewardType) && row.status === "ADMIN_REVERSED").map((row) => row.id);
  const revocations = reversedVouchers.length
    ? await db.select({ entityId: logs.entityId, action: logs.action, metadata: logs.metadata, createdAt: logs.createdAt }).from(logs)
      .where(and(inArray(logs.action, ["REWARD_VOUCHER_VOIDED", "REWARD_VOUCHER_RECONCILIATION_REQUIRED"]), inArray(logs.entityId, reversedVouchers)))
      .orderBy(desc(logs.createdAt))
    : [];
  const revoked = new Map<string, { at: Date; voided: boolean; error: string | null }>();
  for (const row of revocations) {
    if (!row.entityId || revoked.has(row.entityId)) continue;
    revoked.set(row.entityId, {
      at: row.createdAt,
      voided: row.action === "REWARD_VOUCHER_VOIDED",
      error: (row.metadata as { voidError?: string | null } | null)?.voidError ?? null,
    });
  }
  return rows.map((row) => ({
    ...row,
    voucher: isVoucherReward(row.rewardType)
      ? { code: voucherCodeFor(row.id), deferral: latest.get(row.id) ?? null, revocation: revoked.get(row.id) ?? null }
      : null,
  }));
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

// ------------------------------------------------------------ job sources

/** A form field left blank is "not given", never an empty path or header. */
const blankToUndefined = (value: unknown) => (typeof value === "string" && !value.trim() ? undefined : value);
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const jobSourceCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.preprocess(blankToUndefined, z.string().trim().min(2).max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya huruf kecil, angka dan tanda hubung.").optional()),
  /** The only adapter an operator may register; the fixture adapter is sandbox-only. */
  adapter: z.literal("http-json"),
  feedUrl: z.string().trim().min(1).max(2048),
  siteUrl: optionalText(2048),
  category: optionalText(60),
  itemsPath: z.preprocess(blankToUndefined, z.string().trim().max(200).default("items")),
  nextCursorPath: optionalText(200),
  cursorParam: optionalText(60),
  fieldMap: fieldMapSchema,
  /** The NAME of the environment variable holding the token — never the token. */
  credentialEnvVar: z.preprocess(blankToUndefined, z.string().trim()
    .regex(/^[A-Z][A-Z0-9_]{1,63}$/, "Nama variabel environment hanya huruf besar, angka dan garis bawah.").optional()),
  authHeader: optionalText(60),
  authScheme: z.string().max(30).optional(),
  syncIntervalMinutes: z.number().int().min(15).max(10_080).default(360),
  stalenessDays: z.number().int().min(1).max(60).default(7),
  activate: z.boolean().default(false),
  reason: z.string().trim().min(1).max(1000),
});

function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "sumber";
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

/**
 * Register a jobs feed from the console instead of by hand-written SQL.
 *
 * The row is built from the same contract the adapter reads
 * (`httpJsonSourceConfigSchema`), so a source that saves is a source the sync
 * can run — a typo in a field path fails here, naming the field, rather than
 * surfacing hours later as a sync that silently ingested nothing. A credential
 * is referenced by environment variable name only; the value never reaches the
 * database, the audit row or the browser. Plain HTTP is refused outside the
 * local sandbox by the same guard the sync applies.
 */
export async function createAdminJobSource(input: z.infer<typeof jobSourceCreateSchema> & { actorSubject: string; db?: Db }) {
  if (!input.actorSubject.trim()) throw new ArenaDomainError("VALIDATION_ERROR", "Actor is required.");
  const parsed = httpJsonSourceConfigSchema.safeParse({
    baseUrl: input.feedUrl,
    itemsPath: input.itemsPath,
    fieldMap: input.fieldMap,
    ...(input.nextCursorPath ? { nextCursorPath: input.nextCursorPath } : {}),
    ...(input.cursorParam ? { cursorParam: input.cursorParam } : {}),
    ...(input.credentialEnvVar ? { authHeader: input.authHeader ?? "Authorization", authScheme: input.authScheme ?? "Bearer " } : {}),
    ...(input.siteUrl ? { siteUrl: input.siteUrl } : {}),
    ...(input.category ? { category: input.category } : {}),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ArenaDomainError("VALIDATION_ERROR", `Konfigurasi sumber tidak valid (${issue?.path.join(".") || "config"}): ${issue?.message ?? "periksa lagi isiannya"}.`);
  }
  assertFeedTransportAllowed(parsed.data);
  return (input.db ?? getDb()).transaction(async (tx) => {
    const base = input.slug ?? slugify(input.name);
    let slug = base;
    for (let attempt = 2; ; attempt += 1) {
      const [taken] = await tx.select({ id: jobSources.id }).from(jobSources).where(eq(jobSources.slug, slug));
      if (!taken) break;
      if (input.slug) throw new ArenaDomainError("VALIDATION_ERROR", `Slug "${slug}" sudah dipakai sumber lain.`);
      if (attempt > 50) throw new ArenaDomainError("VALIDATION_ERROR", "Tidak menemukan slug yang masih kosong; isi slug secara manual.");
      slug = `${base}-${attempt}`;
    }
    let source: { id: string; slug: string; name: string; isActive: boolean };
    try {
      [source] = await tx.insert(jobSources).values({
        slug, name: input.name, adapter: input.adapter, config: parsed.data,
        credentialEnvVar: input.credentialEnvVar ?? null, isActive: input.activate,
        syncIntervalMinutes: input.syncIntervalMinutes, stalenessDays: input.stalenessDays,
      }).returning({ id: jobSources.id, slug: jobSources.slug, name: jobSources.name, isActive: jobSources.isActive });
    } catch (error) {
      // Two operators racing on one derived slug: the constraint decides.
      if (isUniqueViolation(error)) throw new ArenaDomainError("VALIDATION_ERROR", `Slug "${slug}" baru saja dipakai; coba simpan lagi.`);
      throw error;
    }
    await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "JOBS_SOURCE_CREATED", entityType: "job_source", entityId: source.id,
      metadata: { slug, name: input.name, adapter: input.adapter, feedUrl: parsed.data.baseUrl, category: input.category ?? null,
        credentialEnvVar: input.credentialEnvVar ?? null, isActive: input.activate, reason: input.reason } });
    return { ...source, credentialConfigured: input.credentialEnvVar ? Boolean(process.env[input.credentialEnvVar]) : null };
  });
}
