import { check, index, integer, jsonb, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity";
import { storeDeliveryKind, storeOrderStatus, storePaymentMethod, storeProductKind, storeProductStatus } from "./enums";
import { store } from "./schemas";

/**
 * The digital shop.
 *
 * Deliberately separate from `rewards.catalog`, which sells nothing: a reward
 * is a prize an Arena participant redeems, its stock capped per week, its price
 * always points. A product here is merchandise — unlimited stock, priced in
 * rupiah first, bought by anyone with an account. One table serving both roles
 * would leave half its columns null on every row.
 *
 * What is NOT duplicated is the points balance. The points payment path writes
 * to `rewards.point_ledger`, so a participant's balance stays one number under
 * the `balance >= 0` constraint that already guards it.
 */
export const products = store.table("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique("store_products_slug_unique"),
  title: text("title").notNull(),
  /** One line on the card. The long copy lives in `description`. */
  summary: text("summary"),
  description: text("description"),
  productKind: storeProductKind("product_kind").notNull(),
  status: storeProductStatus("status").default("DRAFT").notNull(),
  /**
   * Both prices are nullable, and that is the whole dual-currency design: one
   * filled means one way to pay, both filled means the buyer chooses. Rupiah is
   * stored in minor units (sen) so no amount is ever a float.
   */
  priceIdrMinor: integer("price_idr_minor"),
  pointsCost: integer("points_cost"),
  coverUrl: text("cover_url"),
  /** DOWNLOAD only: where the goods are. */
  deliveryKind: storeDeliveryKind("delivery_kind"),
  deliveryUrl: text("delivery_url"),
  deliveryObjectKey: text("delivery_object_key"),
  /** Saved as the download's filename, so a buyer does not receive a UUID. */
  deliveryFilename: text("delivery_filename"),
  /**
   * ACCESS only: the key this purchase turns. A protected page asks
   * `hasEntitlement(userId, featureKey)` and nothing else — which is why
   * shipping a new application later needs no change to the shop.
   */
  featureKey: text("feature_key"),
  /** Null means the access never expires. */
  accessDurationDays: integer("access_duration_days"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  /*
   * Whole rupiah only. Midtrans charges integer rupiah — there is no sen to
   * collect — so a price of Rp 49.900,50 could be stored, displayed, and then
   * silently rounded at the gateway into an amount that no longer matches the
   * order the webhook checks against.
   */
  check("store_products_amounts_check", sql`(${table.priceIdrMinor} IS NULL OR (${table.priceIdrMinor} > 0 AND ${table.priceIdrMinor} % 100 = 0)) AND (${table.pointsCost} IS NULL OR ${table.pointsCost} > 0) AND (${table.accessDurationDays} IS NULL OR ${table.accessDurationDays} > 0)`),
  /*
   * Completeness is demanded at ACTIVE, not at DRAFT. A half-written product
   * is a normal thing to save; a half-written product on sale is not. The
   * database draws the line in exactly one place so no code path can skip it.
   */
  check("store_products_sellable_check", sql`${table.status} <> 'ACTIVE' OR ${table.priceIdrMinor} IS NOT NULL OR ${table.pointsCost} IS NOT NULL`),
  check("store_products_kind_check", sql`CASE ${table.productKind}
    WHEN 'ACCESS' THEN ${table.deliveryKind} IS NULL AND ${table.deliveryUrl} IS NULL AND ${table.deliveryObjectKey} IS NULL AND (${table.status} <> 'ACTIVE' OR ${table.featureKey} IS NOT NULL)
    ELSE ${table.featureKey} IS NULL AND ${table.accessDurationDays} IS NULL AND (${table.status} <> 'ACTIVE' OR ${table.deliveryKind} IS NOT NULL)
  END`),
  check("store_products_delivery_target_check", sql`(${table.deliveryKind} IS NULL AND ${table.deliveryUrl} IS NULL AND ${table.deliveryObjectKey} IS NULL)
    OR (${table.deliveryKind} = 'LINK' AND ${table.deliveryUrl} IS NOT NULL AND ${table.deliveryObjectKey} IS NULL)
    OR (${table.deliveryKind} = 'FILE' AND ${table.deliveryObjectKey} IS NOT NULL AND ${table.deliveryUrl} IS NULL)`),
  index("store_products_status_sort_idx").on(table.status, table.sortOrder),
]);

/**
 * One order, one product. A cart would buy nothing here: these are single items
 * a buyer picks deliberately, and a line-item table costs a join on every read
 * to model a basket nobody fills.
 *
 * Title and price are copied onto the order because a price is a fact about a
 * moment. Raising a price next month must not rewrite what somebody paid.
 */
export const orders = store.table("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  paymentMethod: storePaymentMethod("payment_method").notNull(),
  status: storeOrderStatus("status").default("PENDING").notNull(),
  productTitle: text("product_title").notNull(),
  amountIdrMinor: integer("amount_idr_minor"),
  pointsSpent: integer("points_spent"),
  idempotencyKey: text("idempotency_key").notNull().unique("store_orders_idempotency_key_unique"),
  /**
   * Our own reference, minted before Midtrans is called and sent as their
   * `order_id`. It is what a webhook is matched on, so it must exist before
   * any money can move — never assigned from the provider's response.
   */
  providerOrderId: text("provider_order_id").unique("store_orders_provider_order_id_unique"),
  /**
   * Snap's token and payment page for this attempt.
   *
   * Stored rather than re-requested: Midtrans refuses a second transaction for
   * an `order_id` it already knows, so a buyer who closes the popup and comes
   * back must be handed the same token. Asking again would answer "order_id has
   * been used" and strand a payable order behind an error.
   */
  providerToken: text("provider_token"),
  providerRedirectUrl: text("provider_redirect_url"),
  providerStatus: text("provider_status"),
  failureReason: text("failure_reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("store_orders_payment_check", sql`(${table.paymentMethod} = 'IDR' AND ${table.amountIdrMinor} > 0 AND ${table.pointsSpent} IS NULL AND ${table.providerOrderId} IS NOT NULL)
    OR (${table.paymentMethod} = 'POINTS' AND ${table.pointsSpent} > 0 AND ${table.amountIdrMinor} IS NULL AND ${table.providerOrderId} IS NULL)`),
  /*
   * One payment in flight per product per person. This is the double-click
   * guard: two simultaneous checkouts both find no pending order and both try
   * to insert, and the second is refused here rather than leaving the buyer
   * with two payable invoices for one thing. Points orders never sit in
   * PENDING, so their duplicate guard is the entitlement index instead.
   */
  uniqueIndex("store_orders_pending_unique").on(table.userId, table.productId).where(sql`${table.status} = 'PENDING'`),
  index("store_orders_user_created_idx").on(table.userId, table.createdAt),
  index("store_orders_status_created_idx").on(table.status, table.createdAt),
]);

/**
 * What a person owns. One table for both product kinds — a downloadable keeps
 * its right to be fetched again, an application keeps its key — which is what
 * makes "Produk Saya" a single list instead of two that drift apart.
 */
export const entitlements = store.table("entitlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  /** Copied from the product, so retitling a feature key cannot revoke access silently. */
  featureKey: text("feature_key"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  /** Null means forever, which is what every one-off purchase is. */
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedReason: text("revoked_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  /*
   * Partial: one live grant per product per person, while a revoked grant stays
   * as history and leaves the door open to buying the thing again.
   */
  uniqueIndex("store_entitlements_live_unique").on(table.userId, table.productId).where(sql`${table.revokedAt} IS NULL`),
  index("store_entitlements_user_idx").on(table.userId),
  index("store_entitlements_feature_idx").on(table.featureKey),
]);

/**
 * Every payment notification, recorded before it is acted on.
 *
 * Midtrans retries notifications, and retries are not a fault — a lost response
 * looks exactly like a lost payment from their side. The unique `event_key` is
 * what turns a second delivery of the same fact into a no-op instead of a
 * second copy of the goods.
 *
 * The payload stored is a chosen subset, not the raw body: enough to reconcile
 * a payment by hand, nothing that belongs to the buyer's bank.
 */
export const paymentEvents = store.table("payment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id),
  provider: text("provider").default("midtrans").notNull(),
  eventKey: text("event_key").notNull().unique("store_payment_events_event_key_unique"),
  providerOrderId: text("provider_order_id"),
  transactionStatus: text("transaction_status"),
  fraudStatus: text("fraud_status"),
  grossAmountMinor: integer("gross_amount_minor"),
  payload: jsonb("payload"),
  /** Null while the event was recorded but changed nothing (a duplicate, or an order already settled). */
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("store_payment_events_order_idx").on(table.orderId, table.receivedAt),
]);
