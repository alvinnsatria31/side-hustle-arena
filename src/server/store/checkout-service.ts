import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { entitlements, orders, pointLedger, products, users } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { lockPointAccount, reconcilePointAccount } from "@/server/rewards/accounting";
import { notify } from "@/server/notifications/service";
import { writeAudit } from "@/server/reviews/audit";
import { getMidtransConfig, STORE_ORDER_TTL_MINUTES } from "./config";
import { grantEntitlement, isLiveEntitlement } from "./entitlement-service";
import { buildProviderOrderId } from "./midtrans-core";
import { createSnapTransaction } from "./midtrans";

type Db = ReturnType<typeof getDb>;
type Order = typeof orders.$inferSelect;
type Product = typeof products.$inferSelect;

/**
 * Buying.
 *
 * Two payment methods that end in the same place — a settled order and a grant —
 * but reach it along genuinely different roads:
 *
 *   POINTS: one transaction. The money is already ours to move, so the order is
 *           created, debited, and fulfilled without ever being PENDING. There
 *           is nothing to wait for and therefore no window to be interrupted in.
 *
 *   IDR:    a PENDING order first, then a network call, then somebody else's
 *           webhook. Every step can fail independently, so each one is
 *           idempotent and no transaction is ever held open across the network.
 */

export interface CheckoutResult {
  orderId: string;
  status: Order["status"];
  paymentMethod: "IDR" | "POINTS";
  /** Present on a rupiah order: what the browser hands to Snap. */
  payment: { token: string; redirectUrl: string; clientKey: string; environment: "sandbox" | "production" } | null;
}

function domain(code: "PRODUCT_NOT_PURCHASABLE" | "PAYMENT_METHOD_UNAVAILABLE" | "ALREADY_OWNED" | "INSUFFICIENT_POINTS", message: string): never {
  throw new ArenaDomainError(code, message);
}

/** A product may only be bought when it is on sale and priced in the chosen currency. */
function assertPurchasable(product: Product, paymentMethod: "IDR" | "POINTS"): void {
  if (product.status !== "ACTIVE") {
    domain("PRODUCT_NOT_PURCHASABLE", product.status === "COMING_SOON"
      ? "Produk ini belum dijual — statusnya masih segera hadir."
      : "Produk ini tidak tersedia.");
  }
  if (paymentMethod === "IDR" && product.priceIdrMinor === null) {
    domain("PAYMENT_METHOD_UNAVAILABLE", "Produk ini tidak dijual dengan Rupiah.");
  }
  if (paymentMethod === "POINTS" && product.pointsCost === null) {
    domain("PAYMENT_METHOD_UNAVAILABLE", "Produk ini tidak bisa ditukar dengan poin.");
  }
}

/** A live grant means the buyer already has it; an expired one is re-purchasable. */
async function assertNotOwned(userId: string, productId: string, db: Db): Promise<void> {
  const [owned] = await db.select({ id: entitlements.id }).from(entitlements)
    .where(and(eq(entitlements.userId, userId), eq(entitlements.productId, productId), isLiveEntitlement()));
  if (owned) domain("ALREADY_OWNED", "Produk ini sudah kamu miliki. Buka di halaman Produk Saya.");
}

async function loadProduct(slug: string, db: Db): Promise<Product> {
  const [product] = await db.select().from(products).where(eq(products.slug, slug));
  if (!product) throw new ArenaDomainError("PRODUCT_NOT_FOUND", "Produk ini tidak tersedia.");
  return product;
}

export async function startCheckout(input: {
  userId: string;
  slug: string;
  paymentMethod: "IDR" | "POINTS";
  db?: Db;
}): Promise<CheckoutResult> {
  const db = input.db ?? getDb();
  const product = await loadProduct(input.slug, db);
  assertPurchasable(product, input.paymentMethod);
  return input.paymentMethod === "POINTS"
    ? payWithPoints({ userId: input.userId, product, db })
    : payWithRupiah({ userId: input.userId, product, db });
}

/**
 * Points checkout: one transaction, settled on the spot.
 *
 * Ordering matters and follows the reward ladder's: lock the account first,
 * then read the balance, then write. Reading a balance before holding the lock
 * is how two concurrent claims each see enough points and both succeed.
 */
async function payWithPoints(input: { userId: string; product: Product; db: Db }): Promise<CheckoutResult> {
  const { product } = input;
  const cost = product.pointsCost!;
  return input.db.transaction(async (tx) => {
    await lockPointAccount(input.userId, tx);
    await assertNotOwned(input.userId, product.id, tx);
    const totals = await reconcilePointAccount(input.userId, tx);
    if (totals.balance < cost) {
      domain("INSUFFICIENT_POINTS", `Butuh ${cost} poin (saldo kamu ${totals.balance}).`);
    }

    const orderId = randomUUID();
    const now = new Date();
    const [order] = await tx.insert(orders).values({
      id: orderId,
      userId: input.userId,
      productId: product.id,
      paymentMethod: "POINTS",
      status: "FULFILLED",
      productTitle: product.title,
      pointsSpent: cost,
      idempotencyKey: `store:points:${orderId}`,
      paidAt: now,
      fulfilledAt: now,
    }).returning();

    await tx.insert(pointLedger).values({
      userId: input.userId,
      amount: -cost,
      entryType: "STORE_PURCHASE",
      referenceType: "store_order",
      referenceId: order.id,
      description: `Pembelian toko: ${product.slug}`,
      idempotencyKey: `store-order:${order.id}:debit`,
    });
    await reconcilePointAccount(input.userId, tx);

    await grantEntitlement({
      userId: input.userId,
      productId: product.id,
      orderId: order.id,
      featureKey: product.featureKey,
      accessDurationDays: product.accessDurationDays,
      now,
      db: tx,
    });

    await writeAudit(tx, {
      actorType: "USER",
      actorSubject: input.userId,
      action: "STORE_ORDER_FULFILLED",
      entityType: "store_order",
      entityId: order.id,
      metadata: { slug: product.slug, paymentMethod: "POINTS", pointsSpent: cost },
    });
    await notify({
      type: "REWARD_FULFILLED",
      userId: input.userId,
      title: `"${product.title}" sudah jadi milikmu`,
      body: `${cost} poin telah dipotong. Buka produkmu lewat halaman Produk Saya.`,
      actionUrl: "/app/store",
    }, tx);

    return { orderId: order.id, status: order.status, paymentMethod: "POINTS" as const, payment: null };
  });
}

/**
 * Rupiah checkout: a payable order, then Snap.
 *
 * The order exists before Midtrans is told about it, and its id is what becomes
 * their `order_id`. Doing it the other way — asking Midtrans first and recording
 * afterwards — means a payment can complete against a reference that does not
 * exist on our side, which is the one failure in a payment integration nobody
 * can clean up automatically.
 *
 * The network call deliberately sits outside the transaction. A transaction held
 * open across a fifteen-second HTTP call holds row locks for fifteen seconds.
 */
async function payWithRupiah(input: { userId: string; product: Product; db: Db }): Promise<CheckoutResult> {
  const { product } = input;
  const now = new Date();

  const existing = await input.db.transaction(async (tx) => {
    await assertNotOwned(input.userId, product.id, tx);
    const [pending] = await tx.select().from(orders)
      .where(and(eq(orders.userId, input.userId), eq(orders.productId, product.id), eq(orders.status, "PENDING")))
      .for("update");
    if (!pending) return null;
    /*
     * A pending order past its expiry is not reusable — Snap has expired its
     * token too — so it is written off here and a fresh one is created below,
     * rather than left to a sweep the buyer would have to wait for.
     */
    if (pending.expiresAt && pending.expiresAt <= now) {
      await tx.update(orders).set({ status: "EXPIRED", failureReason: "Batas waktu pembayaran lewat.", updatedAt: now })
        .where(eq(orders.id, pending.id));
      return null;
    }
    return pending;
  });

  if (existing?.providerToken && existing.providerRedirectUrl) {
    const config = getMidtransConfig();
    return {
      orderId: existing.id,
      status: existing.status,
      paymentMethod: "IDR",
      payment: {
        token: existing.providerToken,
        redirectUrl: existing.providerRedirectUrl,
        clientKey: config.clientKey,
        environment: config.environment,
      },
    };
  }

  /*
   * A pending order with no token is one whose Snap call died between the
   * insert and the update. It cannot be retried under the same provider order
   * id — Midtrans already knows it — so it is abandoned and replaced.
   */
  if (existing) {
    await input.db.update(orders)
      .set({ status: "FAILED", failureReason: "Pembuatan pembayaran tidak selesai.", updatedAt: now })
      .where(eq(orders.id, existing.id));
  }

  const orderId = randomUUID();
  const providerOrderId = buildProviderOrderId(orderId);
  const expiresAt = new Date(now.getTime() + STORE_ORDER_TTL_MINUTES * 60_000);
  const [order] = await input.db.insert(orders).values({
    id: orderId,
    userId: input.userId,
    productId: product.id,
    paymentMethod: "IDR",
    status: "PENDING",
    productTitle: product.title,
    amountIdrMinor: product.priceIdrMinor!,
    idempotencyKey: `store:idr:${orderId}`,
    providerOrderId,
    expiresAt,
  }).returning();

  const [buyer] = await input.db
    .select({ name: users.displayNameCache, email: users.emailCache })
    .from(users).where(eq(users.id, input.userId));

  try {
    const snap = await createSnapTransaction({
      providerOrderId,
      amountMinor: product.priceIdrMinor!,
      productTitle: product.title,
      productSlug: product.slug,
      customerName: buyer?.name ?? null,
      customerEmail: buyer?.email ?? null,
      expiryMinutes: STORE_ORDER_TTL_MINUTES,
    });
    await input.db.update(orders)
      .set({ providerToken: snap.token, providerRedirectUrl: snap.redirectUrl, updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    await writeAudit(input.db, {
      actorType: "USER",
      actorSubject: input.userId,
      action: "STORE_ORDER_CREATED",
      entityType: "store_order",
      entityId: order.id,
      metadata: { slug: product.slug, paymentMethod: "IDR", amountIdrMinor: product.priceIdrMinor, providerOrderId },
    });
    return {
      orderId: order.id,
      status: "PENDING",
      paymentMethod: "IDR",
      payment: { token: snap.token, redirectUrl: snap.redirectUrl, clientKey: snap.clientKey, environment: snap.environment },
    };
  } catch (error) {
    /*
     * Close the order the buyer can no longer pay. Left PENDING it would block
     * the next attempt on the partial unique index — one gateway hiccup would
     * lock somebody out of the product for an hour.
     */
    await input.db.update(orders)
      .set({ status: "FAILED", failureReason: "Gagal membuat pembayaran di Midtrans.", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    throw error;
  }
}

/**
 * Settle a paid rupiah order and hand over the goods.
 *
 * Reachable from the webhook and, if a notification is ever lost, by an admin.
 * Both land here, and both may land here twice: an order already FULFILLED is
 * returned unchanged rather than granted a second time.
 */
export async function fulfillPaidOrder(input: {
  orderId: string;
  actorType: "AUTOMATION" | "ADMIN";
  actorSubject: string;
  providerStatus?: string | null;
  db?: Db;
}): Promise<{ fulfilled: boolean; order: Order }> {
  const db = input.db ?? getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).for("update");
    if (!order) throw new ArenaDomainError("VALIDATION_ERROR", "Pesanan tidak ditemukan.");
    if (order.status === "FULFILLED") return { fulfilled: false, order };
    if (order.status !== "PENDING" && order.status !== "PAID") {
      throw new ArenaDomainError("VALIDATION_ERROR", `Pesanan berstatus ${order.status} tidak bisa diserahkan.`);
    }

    const [product] = await tx.select().from(products).where(eq(products.id, order.productId));
    if (!product) throw new ArenaDomainError("PRODUCT_NOT_FOUND", "Produk pesanan ini tidak ditemukan.");

    const now = new Date();
    const [settled] = await tx.update(orders).set({
      status: "FULFILLED",
      paidAt: order.paidAt ?? now,
      fulfilledAt: now,
      providerStatus: input.providerStatus ?? order.providerStatus,
      updatedAt: now,
    }).where(eq(orders.id, order.id)).returning();

    await grantEntitlement({
      userId: order.userId,
      productId: order.productId,
      orderId: order.id,
      featureKey: product.featureKey,
      accessDurationDays: product.accessDurationDays,
      now,
      db: tx,
    });

    await writeAudit(tx, {
      actorType: input.actorType,
      actorSubject: input.actorSubject,
      action: "STORE_ORDER_FULFILLED",
      entityType: "store_order",
      entityId: order.id,
      metadata: {
        slug: product.slug,
        paymentMethod: order.paymentMethod,
        amountIdrMinor: order.amountIdrMinor,
        providerStatus: input.providerStatus ?? null,
      },
    });
    await notify({
      type: "REWARD_FULFILLED",
      userId: order.userId,
      title: `"${product.title}" sudah jadi milikmu`,
      body: "Pembayaranmu sudah diterima. Buka produkmu lewat halaman Produk Saya.",
      actionUrl: "/app/store",
    }, tx);

    return { fulfilled: true, order: settled };
  });
}

/**
 * Close an order that will never be paid.
 *
 * Nothing is granted and nothing is charged, so this is a status change and an
 * audit row — but it is the one that frees the buyer to try again, so it must
 * not be left to a sweep alone.
 */
export async function closeUnpaidOrder(input: {
  orderId: string;
  status: "FAILED" | "EXPIRED";
  reason: string;
  actorType: "AUTOMATION" | "ADMIN";
  actorSubject: string;
  providerStatus?: string | null;
  db?: Db;
}): Promise<{ closed: boolean }> {
  const db = input.db ?? getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).for("update");
    if (!order) throw new ArenaDomainError("VALIDATION_ERROR", "Pesanan tidak ditemukan.");
    // A settled order is never reopened by a late "expire" notification.
    if (order.status !== "PENDING") return { closed: false };
    const now = new Date();
    await tx.update(orders).set({
      status: input.status,
      failureReason: input.reason,
      providerStatus: input.providerStatus ?? order.providerStatus,
      updatedAt: now,
    }).where(eq(orders.id, order.id));
    await writeAudit(tx, {
      actorType: input.actorType,
      actorSubject: input.actorSubject,
      action: input.status === "EXPIRED" ? "STORE_ORDER_EXPIRED" : "STORE_ORDER_FAILED",
      entityType: "store_order",
      entityId: order.id,
      metadata: { reason: input.reason, providerStatus: input.providerStatus ?? null },
    });
    return { closed: true };
  });
}

/**
 * Sweep pending orders whose payment window has closed.
 *
 * Midtrans does send an `expire` notification, but a notification that never
 * arrives leaves a PENDING row blocking the buyer's next attempt forever. This
 * is the floor under that: scheduled, bounded, and safe to run at any time
 * because it only touches orders already past their own deadline.
 */
export async function expireStaleOrders(now: Date = new Date(), db: Db = getDb()): Promise<{ expired: number }> {
  const stale = await db.select({ id: orders.id }).from(orders)
    .where(and(eq(orders.status, "PENDING"), lt(orders.expiresAt, now)))
    .limit(200);
  let expired = 0;
  for (const row of stale) {
    const result = await closeUnpaidOrder({
      orderId: row.id,
      status: "EXPIRED",
      reason: "Batas waktu pembayaran lewat.",
      actorType: "AUTOMATION",
      actorSubject: "store-expiry-sweep",
      db,
    }).catch((error: unknown) => {
      console.error(`[store] could not expire order ${row.id}:`, error);
      return { closed: false };
    });
    if (result.closed) expired += 1;
  }
  return { expired };
}

export interface OrderSummary {
  id: string;
  slug: string | null;
  productTitle: string;
  paymentMethod: "IDR" | "POINTS";
  status: Order["status"];
  amountIdrMinor: number | null;
  pointsSpent: number | null;
  createdAt: string;
  paidAt: string | null;
  /** Only on a payable order: lets the buyer resume a payment they abandoned. */
  payment: { token: string; redirectUrl: string } | null;
}

export async function listUserOrders(userId: string, db: Db = getDb()): Promise<OrderSummary[]> {
  const rows = await db
    .select({
      id: orders.id,
      slug: products.slug,
      productTitle: orders.productTitle,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      amountIdrMinor: orders.amountIdrMinor,
      pointsSpent: orders.pointsSpent,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      expiresAt: orders.expiresAt,
      providerToken: orders.providerToken,
      providerRedirectUrl: orders.providerRedirectUrl,
    })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    productTitle: row.productTitle,
    paymentMethod: row.paymentMethod,
    status: row.status,
    amountIdrMinor: row.amountIdrMinor,
    pointsSpent: row.pointsSpent,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    payment: row.status === "PENDING" && row.providerToken && row.providerRedirectUrl
      && (!row.expiresAt || row.expiresAt.getTime() > now)
      ? { token: row.providerToken, redirectUrl: row.providerRedirectUrl }
      : null,
  }));
}

/** Console view: recent orders across everybody, newest first. */
export async function listAllOrders(input: { status?: Order["status"]; limit?: number } = {}, db: Db = getDb()) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const rows = await db
    .select({
      id: orders.id,
      slug: products.slug,
      productTitle: orders.productTitle,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      amountIdrMinor: orders.amountIdrMinor,
      pointsSpent: orders.pointsSpent,
      providerOrderId: orders.providerOrderId,
      providerStatus: orders.providerStatus,
      failureReason: orders.failureReason,
      buyer: users.displayNameCache,
      buyerEmail: users.emailCache,
      createdAt: orders.createdAt,
      fulfilledAt: orders.fulfilledAt,
    })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(input.status ? eq(orders.status, input.status) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
  }));
}

/**
 * Refund a points purchase: give the points back and withdraw the grant.
 *
 * Rupiah refunds are not done here. Money leaves through Midtrans' own refund
 * flow and is reconciled by hand; pretending otherwise would let the console
 * mark a buyer refunded while their bank account disagrees.
 */
export async function refundPointsOrder(input: {
  orderId: string;
  reason: string;
  actorSubject: string;
  db?: Db;
}): Promise<void> {
  const reason = input.reason.trim();
  if (!reason || reason.length > 1000) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Alasan pengembalian wajib diisi (1-1000 karakter).");
  }
  const db = input.db ?? getDb();
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId));
    if (!order) throw new ArenaDomainError("VALIDATION_ERROR", "Pesanan tidak ditemukan.");
    if (order.paymentMethod !== "POINTS") {
      throw new ArenaDomainError("VALIDATION_ERROR", "Hanya pesanan berpoin yang bisa dikembalikan di sini. Pesanan Rupiah direfund lewat dashboard Midtrans.");
    }
    await lockPointAccount(order.userId, tx);
    const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
    if (locked.status === "REFUNDED") return;
    if (locked.status !== "FULFILLED") throw new ArenaDomainError("VALIDATION_ERROR", "Hanya pesanan selesai yang bisa dikembalikan.");

    const now = new Date();
    await tx.insert(pointLedger).values({
      userId: locked.userId,
      amount: locked.pointsSpent!,
      entryType: "STORE_REFUND",
      referenceType: "store_order",
      referenceId: locked.id,
      description: `Pengembalian poin: ${locked.productTitle}`,
      idempotencyKey: `store-order:${locked.id}:refund`,
    });
    await reconcilePointAccount(locked.userId, tx);
    await tx.update(orders).set({ status: "REFUNDED", failureReason: reason, updatedAt: now }).where(eq(orders.id, locked.id));
    // Taking the points back without taking the goods back would be a free product.
    await tx.update(entitlements)
      .set({ revokedAt: now, revokedReason: `REFUNDED: ${reason}`, updatedAt: now })
      .where(and(eq(entitlements.orderId, locked.id), isNull(entitlements.revokedAt)));
    await writeAudit(tx, {
      actorType: "ADMIN",
      actorSubject: input.actorSubject,
      action: "STORE_ORDER_REFUNDED",
      entityType: "store_order",
      entityId: locked.id,
      metadata: { reason, pointsReturned: locked.pointsSpent },
    });
    await notify({
      type: "POINTS_AWARDED",
      userId: locked.userId,
      title: "Poin pembelian dikembalikan",
      body: `Pesanan "${locked.productTitle}" dibatalkan dan ${locked.pointsSpent} poin sudah kembali ke saldomu.`,
      actionUrl: "/app/store",
    }, tx);
  });
}
