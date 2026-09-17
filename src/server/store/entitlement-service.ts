import "server-only";
import { and, desc, eq, gt, isNull, or, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { entitlements, orders, products } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";

type Db = ReturnType<typeof getDb>;

/**
 * Ownership.
 *
 * One table answers two questions that look different and are not: may this
 * person download that file again, and may this person open that application.
 * Both are "is there a grant of this product to this person that has not been
 * revoked and has not run out".
 */

/**
 * The definition of a live grant, as a reusable predicate.
 *
 * Written once because every caller that forgets half of it is a security bug:
 * checking `revoked_at IS NULL` alone hands an expired licence back its key,
 * and checking expiry alone honours a grant an admin has already withdrawn.
 */
export function isLiveEntitlement(now: Date = new Date()): SQL {
  return and(
    isNull(entitlements.revokedAt),
    or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now)),
  )!;
}

/**
 * Does this person hold the key to this feature?
 *
 * The one call a protected page makes. `/app/360` is the first caller; every
 * application sold later asks the same question with its own key, which is why
 * shipping one needs no change to the shop.
 */
export async function hasEntitlement(userId: string, featureKey: string, db: Db = getDb()): Promise<boolean> {
  const [row] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), eq(entitlements.featureKey, featureKey), isLiveEntitlement()))
    .limit(1);
  return Boolean(row);
}

export interface OwnedProduct {
  entitlementId: string;
  slug: string;
  title: string;
  summary: string | null;
  productKind: "DOWNLOAD" | "ACCESS";
  coverUrl: string | null;
  featureKey: string | null;
  grantedAt: string;
  expiresAt: string | null;
  /** Where an ACCESS product is opened; null for a download. */
  openPath: string | null;
}

/**
 * Where a feature key leads.
 *
 * A map rather than a column, because the destination is a route in this
 * codebase: a database that could name any path would be a redirect an admin
 * could point anywhere. Adding an application means adding its line here, next
 * to the page that reads the same key.
 */
const featurePaths: Record<string, string> = {
  "app-360": "/app/360",
};

export function featurePath(featureKey: string | null): string | null {
  return featureKey ? featurePaths[featureKey] ?? null : null;
}

export async function listOwnedProducts(userId: string, db: Db = getDb()): Promise<OwnedProduct[]> {
  const rows = await db
    .select({
      entitlementId: entitlements.id,
      slug: products.slug,
      title: products.title,
      summary: products.summary,
      productKind: products.productKind,
      coverUrl: products.coverUrl,
      featureKey: entitlements.featureKey,
      grantedAt: entitlements.grantedAt,
      expiresAt: entitlements.expiresAt,
    })
    .from(entitlements)
    .innerJoin(products, eq(products.id, entitlements.productId))
    .where(and(eq(entitlements.userId, userId), isLiveEntitlement()))
    .orderBy(desc(entitlements.grantedAt));

  return rows.map((row) => ({
    ...row,
    grantedAt: row.grantedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    openPath: row.productKind === "ACCESS" ? featurePath(row.featureKey) : null,
  }));
}

/**
 * Hand over ownership for a settled order. Requires the caller's transaction.
 *
 * Idempotent by the order it settles: fulfilment can be reached twice — a
 * retried webhook that slipped past the event table, an admin settling by hand
 * at the same moment — and the second pass must find the grant already made
 * rather than create a duplicate the partial unique index would reject anyway.
 *
 * An expired grant for the same product is revoked first, not reused. That is
 * what makes a lapsed licence re-purchasable while keeping the old term in the
 * record instead of quietly overwriting when it ran out.
 */
export async function grantEntitlement(input: {
  userId: string;
  productId: string;
  orderId: string;
  featureKey: string | null;
  accessDurationDays: number | null;
  now?: Date;
  db: Db;
}): Promise<typeof entitlements.$inferSelect> {
  const now = input.now ?? new Date();
  const [existingForOrder] = await input.db
    .select().from(entitlements).where(eq(entitlements.orderId, input.orderId));
  if (existingForOrder) return existingForOrder;

  const [lapsed] = await input.db
    .select().from(entitlements)
    .where(and(eq(entitlements.userId, input.userId), eq(entitlements.productId, input.productId), isNull(entitlements.revokedAt)))
    .for("update");
  if (lapsed) {
    if (!lapsed.expiresAt || lapsed.expiresAt > now) {
      throw new ArenaDomainError("ALREADY_OWNED", "Produk ini sudah dimiliki.");
    }
    await input.db.update(entitlements)
      .set({ revokedAt: now, revokedReason: "EXPIRED_REPURCHASED", updatedAt: now })
      .where(eq(entitlements.id, lapsed.id));
  }

  const [granted] = await input.db.insert(entitlements).values({
    userId: input.userId,
    productId: input.productId,
    orderId: input.orderId,
    featureKey: input.featureKey,
    grantedAt: now,
    expiresAt: input.accessDurationDays
      ? new Date(now.getTime() + input.accessDurationDays * 86_400_000)
      : null,
  }).returning();
  return granted;
}

/**
 * Withdraw a grant — a refund, a chargeback, an admin correction.
 *
 * Points are not returned here. A refund of points is a ledger entry and
 * belongs to the order, not to the key; keeping the two apart is what stops a
 * revocation from silently minting points nobody paid.
 */
export async function revokeEntitlement(input: {
  entitlementId: string;
  reason: string;
  actorSubject: string;
  db?: Db;
}): Promise<void> {
  const reason = input.reason.trim();
  if (!reason || reason.length > 1000) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Alasan pencabutan wajib diisi (1-1000 karakter).");
  }
  const db = input.db ?? getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(entitlements).where(eq(entitlements.id, input.entitlementId)).for("update");
    if (!row) throw new ArenaDomainError("ENTITLEMENT_NOT_FOUND", "Kepemilikan ini tidak ditemukan.");
    if (row.revokedAt) return;
    const now = new Date();
    await tx.update(entitlements).set({ revokedAt: now, revokedReason: reason, updatedAt: now }).where(eq(entitlements.id, row.id));
    await writeAudit(tx, {
      actorType: "ADMIN",
      actorSubject: input.actorSubject,
      action: "STORE_ENTITLEMENT_REVOKED",
      entityType: "store_entitlement",
      entityId: row.id,
      metadata: { reason, productId: row.productId, orderId: row.orderId },
    });
  });
}

/** The order a grant came from, for the receipt shown next to it. */
export async function findEntitlementForDownload(input: { userId: string; slug: string; db?: Db }) {
  const db = input.db ?? getDb();
  const [row] = await db
    .select({
      entitlement: entitlements,
      product: products,
      orderId: orders.id,
    })
    .from(entitlements)
    .innerJoin(products, eq(products.id, entitlements.productId))
    .innerJoin(orders, eq(orders.id, entitlements.orderId))
    .where(and(eq(entitlements.userId, input.userId), eq(products.slug, input.slug), isLiveEntitlement()));
  if (!row) throw new ArenaDomainError("ENTITLEMENT_NOT_FOUND", "Kamu belum memiliki produk ini.");
  return row;
}
