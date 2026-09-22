/**
 * Midtrans fulfillment against the sandbox database.
 *
 * Covers `handleMidtransNotification` in
 * `src/server/store/payment-service.ts` through a real Postgres, not the
 * pure-function suite in `scripts/store-checkout.test.mjs`:
 *
 *   1. valid signature + matching amount -> FULFILLED (order settled, grant live)
 *   2. same notification twice -> DUPLICATE, exactly one grant and one event row
 *   3. amount mismatch -> AMOUNT_MISMATCH, order stays PENDING, nothing granted
 *   4. unknown order -> UNKNOWN_ORDER, event recorded, nothing else happens
 *   5. capture/challenge -> PENDING, order stays PENDING, nothing granted
 *
 * Needs the local sandbox database only (`node scripts/local-dev.mjs
 * --setup-only`). Touches no Midtrans API: notifications are built locally
 * and signed with the server key read from the environment. Run with:
 *
 *   node --import ./scripts/node-test-hooks.mjs --test --test-force-exit scripts/store-fulfillment.test.mjs
 */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema/index.ts";
import { handleMidtransNotification } from "../src/server/store/payment-service.ts";
import { buildProviderOrderId } from "../src/server/store/midtrans-core.ts";

nextEnv.loadEnvConfig(process.cwd());
assert.ok(
  ["development", "test"].includes(process.env.APP_ENV),
  "Store fulfillment fixtures require APP_ENV=development or test (non-production database)",
);
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured for store fulfillment tests");
assert.match(process.env.DATABASE_URL, /127\.0\.0\.1|localhost/, "Store fulfillment tests refuse non-loopback DATABASE_URL");

// The key is read, never written in source: reuse the sandbox value when it
// exists, otherwise mint a random one so `getMidtransConfig()` still resolves
// and the signature below always matches what the handler verifies against.
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY?.trim() || `test-server-${randomUUID()}`;
if (!process.env.MIDTRANS_SERVER_KEY?.trim()) process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
if (!process.env.MIDTRANS_CLIENT_KEY?.trim()) process.env.MIDTRANS_CLIENT_KEY = `test-client-${randomUUID()}`;

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const db = drizzle({ client: sql, schema });
after(() => sql.end({ timeout: 5 }));

// Rp 149.000 in minor units (sen). Whole rupiah so it survives the
// `store_products_amounts_check` (% 100 = 0) and the Midtrans integer-rupiah rule.
const ORDER_MINOR = 14_900_000;
const GROSS_MATCH = "149000.00";

function signedNotification({ providerOrderId, grossAmount, transactionStatus, fraudStatus, statusCode = "200" }) {
  const base = {
    order_id: providerOrderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    transaction_status: transactionStatus,
    ...(fraudStatus ? { fraud_status: fraudStatus } : {}),
  };
  return {
    ...base,
    signature_key: createHash("sha512")
      .update(`${base.order_id}${base.status_code}${base.gross_amount}${SERVER_KEY}`)
      .digest("hex"),
  };
}

/**
 * One buyer, one ACCESS product, one PENDING rupiah order.
 *
 * The order is inserted directly instead of going through `startCheckout`
 * (checkout-service.ts): that path calls Snap over the network, which this
 * suite must not do. The row it writes is the same shape `payWithRupiah`
 * writes — PENDING, billed amount, provider order id — so the webhook under
 * test cannot tell the difference.
 */
async function createPendingOrderFixture(t) {
  const stamp = randomUUID();
  const [user] = await db
    .insert(schema.users)
    .values({ authSubject: `store-fulfill-${stamp}`, emailCache: "fixture@example.invalid" })
    .returning();
  const [product] = await db
    .insert(schema.products)
    .values({
      slug: `fulfill-${stamp}`,
      title: `Fixture ${stamp.slice(0, 8)}`,
      productKind: "ACCESS",
      status: "ACTIVE",
      priceIdrMinor: ORDER_MINOR,
      featureKey: `fixture-${stamp}`,
    })
    .returning();
  const orderId = randomUUID();
  const providerOrderId = buildProviderOrderId(orderId);
  const [order] = await db
    .insert(schema.orders)
    .values({
      id: orderId,
      userId: user.id,
      productId: product.id,
      paymentMethod: "IDR",
      status: "PENDING",
      productTitle: product.title,
      amountIdrMinor: ORDER_MINOR,
      idempotencyKey: `store:idr:${orderId}`,
      providerOrderId,
      expiresAt: new Date(Date.now() + 3600_000),
    })
    .returning();

  t.after(async () => {
    await sql`delete from store.payment_events where order_id = ${order.id}`;
    await sql`delete from store.entitlements where order_id = ${order.id}`;
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${user.id})`;
    await sql`delete from notifications.events where user_id = ${user.id}`;
    await sql`delete from store.orders where id = ${order.id}`;
    await sql`delete from store.products where id = ${product.id}`;
    await sql`delete from identity.users where id = ${user.id}`;
  });

  return { user, product, order, providerOrderId };
}

test("a settled notification with a valid signature fulfills the order and grants the product", async (t) => {
  const { order, providerOrderId } = await createPendingOrderFixture(t);
  const notification = signedNotification({
    providerOrderId,
    grossAmount: GROSS_MATCH,
    transactionStatus: "settlement",
    fraudStatus: "accept",
  });

  const result = await handleMidtransNotification(notification, db);
  assert.deepEqual(result, { handled: true, outcome: "FULFILLED" });

  const [stored] = await sql`select status, paid_at, fulfilled_at from store.orders where id = ${order.id}`;
  assert.equal(stored.status, "FULFILLED");
  assert.ok(stored.paid_at !== null, "fulfilment records when the order was paid");
  assert.ok(stored.fulfilled_at !== null, "fulfilment records when the goods were handed over");

  const grants = await sql`select id, revoked_at from store.entitlements where order_id = ${order.id}`;
  assert.equal(grants.length, 1, "exactly one grant is issued for the order");
  assert.equal(grants[0].revoked_at, null, "the grant is live, not revoked");

  const events = await sql`select applied_at from store.payment_events where provider_order_id = ${providerOrderId}`;
  assert.equal(events.length, 1, "the notification is recorded");
  assert.ok(events[0].applied_at !== null, "an applied event is marked applied");
});

test("replaying the same notification is a no-op: no second grant, no second event row", async (t) => {
  const { order, providerOrderId } = await createPendingOrderFixture(t);
  const notification = signedNotification({
    providerOrderId,
    grossAmount: GROSS_MATCH,
    transactionStatus: "settlement",
    fraudStatus: "accept",
  });

  const first = await handleMidtransNotification(notification, db);
  assert.deepEqual(first, { handled: true, outcome: "FULFILLED" });

  const replay = await handleMidtransNotification({ ...notification }, db);
  assert.deepEqual(replay, { handled: true, outcome: "DUPLICATE" });

  const grants = await sql`select id from store.entitlements where order_id = ${order.id}`;
  assert.equal(grants.length, 1, "the replay must not grant the product twice");

  const [{ count }] = await sql`select count(*)::int as count from store.payment_events where provider_order_id = ${providerOrderId}`;
  assert.equal(count, 1, "the same eventKey must not be stored twice");

  const [stored] = await sql`select status from store.orders where id = ${order.id}`;
  assert.equal(stored.status, "FULFILLED");
});

test("a correctly signed notification for the wrong amount is rejected and grants nothing", async (t) => {
  const { order, providerOrderId } = await createPendingOrderFixture(t);
  // Signed for "1000.00", so the signature is valid — the handler must still
  // refuse it because the amount does not equal what the order billed.
  const notification = signedNotification({
    providerOrderId,
    grossAmount: "1000.00",
    transactionStatus: "settlement",
    fraudStatus: "accept",
  });

  const result = await handleMidtransNotification(notification, db);
  assert.deepEqual(result, { handled: true, outcome: "AMOUNT_MISMATCH" });

  const [stored] = await sql`select status from store.orders where id = ${order.id}`;
  assert.equal(stored.status, "PENDING", "a mismatched payment must not settle the order");

  const grants = await sql`select id from store.entitlements where order_id = ${order.id}`;
  assert.equal(grants.length, 0, "a mismatched payment must not grant anything");
});

test("a notification for an order that does not exist is answered 200 with no side effects", async (t) => {
  const ghostProviderOrderId = `ARENA-STORE-${randomUUID()}`;
  t.after(async () => {
    await sql`delete from store.payment_events where provider_order_id = ${ghostProviderOrderId}`;
  });
  const notification = signedNotification({
    providerOrderId: ghostProviderOrderId,
    grossAmount: GROSS_MATCH,
    transactionStatus: "settlement",
    fraudStatus: "accept",
  });

  // `handled: true` is what lets the route answer 200: Midtrans stops
  // retrying, so one undeliverable notification cannot bury real failures.
  const result = await handleMidtransNotification(notification, db);
  assert.deepEqual(result, { handled: true, outcome: "UNKNOWN_ORDER" });

  const orders = await sql`select id from store.orders where provider_order_id = ${ghostProviderOrderId}`;
  assert.equal(orders.length, 0, "an unknown notification must not create an order");

  const [event] = await sql`select order_id, applied_at from store.payment_events where provider_order_id = ${ghostProviderOrderId}`;
  assert.ok(event, "the unknown notification is still recorded for reconciliation");
  assert.equal(event.order_id, null);
  assert.ok(event.applied_at !== null, "the recorded unknown event is marked applied");

  const grants = await sql`select id from store.entitlements where order_id in (select id from store.orders where provider_order_id = ${ghostProviderOrderId})`;
  assert.equal(grants.length, 0);
});

test("a challenged capture stays pending: recorded, order untouched, nothing granted", async (t) => {
  const { order, providerOrderId } = await createPendingOrderFixture(t);
  const notification = signedNotification({
    providerOrderId,
    grossAmount: GROSS_MATCH,
    transactionStatus: "capture",
    fraudStatus: "challenge",
  });

  const result = await handleMidtransNotification(notification, db);
  assert.deepEqual(result, { handled: true, outcome: "PENDING" });

  const [stored] = await sql`select status, provider_status from store.orders where id = ${order.id}`;
  assert.equal(stored.status, "PENDING", "a held payment must not settle the order");
  assert.equal(stored.provider_status, "capture/challenge");

  const grants = await sql`select id from store.entitlements where order_id = ${order.id}`;
  assert.equal(grants.length, 0, "a held payment must not grant anything");

  const events = await sql`select applied_at from store.payment_events where provider_order_id = ${providerOrderId}`;
  assert.equal(events.length, 1, "the pending news is still worth recording");
  assert.ok(events[0].applied_at !== null);
});
