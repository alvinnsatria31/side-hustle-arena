import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

const midtrans = await import("../src/server/store/midtrans-core.ts");
const accounting = await import("../src/server/rewards/accounting.ts");

const SERVER_KEY = "SB-Mid-server-TESTKEY";

function notification(overrides = {}) {
  const base = {
    order_id: "ARENA-STORE-11111111-2222-3333-4444-555555555555",
    status_code: "200",
    gross_amount: "149000.00",
    transaction_status: "settlement",
    fraud_status: "accept",
    ...overrides,
  };
  return {
    ...base,
    signature_key: createHash("sha512")
      .update(`${base.order_id}${base.status_code}${base.gross_amount}${SERVER_KEY}`)
      .digest("hex"),
  };
}

// ----------------------------------------------------------- signature

test("a notification signed with our server key verifies", () => {
  assert.equal(midtrans.verifyMidtransSignature(notification(), SERVER_KEY), true);
});

test("changing the amount after signing invalidates the notification", () => {
  // The amount is inside the digest, which is what stops somebody who learned
  // an order id from claiming it was paid for one rupiah.
  const tampered = { ...notification(), gross_amount: "1000.00" };
  assert.equal(midtrans.verifyMidtransSignature(tampered, SERVER_KEY), false);
});

test("a notification signed with a different server key is refused", () => {
  assert.equal(midtrans.verifyMidtransSignature(notification(), "SB-Mid-server-OTHERKEY"), false);
});

test("a missing or truncated signature is refused rather than crashing", () => {
  assert.equal(midtrans.verifyMidtransSignature({ ...notification(), signature_key: "" }, SERVER_KEY), false);
  assert.equal(midtrans.verifyMidtransSignature({ ...notification(), signature_key: "abc" }, SERVER_KEY), false);
  assert.equal(midtrans.verifyMidtransSignature({ ...notification(), signature_key: undefined }, SERVER_KEY), false);
});

test("an uppercase signature still verifies", () => {
  const signed = notification();
  const upper = { ...signed, signature_key: signed.signature_key.toUpperCase() };
  assert.equal(midtrans.verifyMidtransSignature(upper, SERVER_KEY), true);
});

// ----------------------------------------------------------- outcomes

test("settlement and accepted capture are the only outcomes that deliver", () => {
  assert.equal(midtrans.paymentOutcome("settlement"), "PAID");
  assert.equal(midtrans.paymentOutcome("capture", "accept"), "PAID");
});

test("a challenged capture waits instead of delivering", () => {
  // Midtrans is holding it for a human. Delivering now would mean delivering on
  // a payment that can still be denied.
  assert.equal(midtrans.paymentOutcome("capture", "challenge"), "PENDING");
  assert.equal(midtrans.paymentOutcome("capture", null), "PENDING");
});

test("refusals, expiry and refunds map to their own outcomes", () => {
  assert.equal(midtrans.paymentOutcome("deny"), "FAILED");
  assert.equal(midtrans.paymentOutcome("cancel"), "FAILED");
  assert.equal(midtrans.paymentOutcome("failure"), "FAILED");
  assert.equal(midtrans.paymentOutcome("expire"), "EXPIRED");
  assert.equal(midtrans.paymentOutcome("refund"), "REFUNDED");
  assert.equal(midtrans.paymentOutcome("partial_refund"), "REFUNDED");
});

test("an unknown transaction status never delivers", () => {
  assert.equal(midtrans.paymentOutcome("something_new_from_midtrans"), "PENDING");
});

// ----------------------------------------------------------- idempotency

test("the same notification twice produces the same event key", () => {
  const signed = notification();
  assert.equal(midtrans.paymentEventKey(signed), midtrans.paymentEventKey({ ...signed }));
});

test("two different states of one order produce different event keys", () => {
  // Otherwise "pending" would suppress the "settlement" that follows it, and
  // the payment would never be applied.
  const pending = notification({ transaction_status: "pending" });
  const settled = notification({ transaction_status: "settlement" });
  assert.notEqual(midtrans.paymentEventKey(pending), midtrans.paymentEventKey(settled));
});

// ----------------------------------------------------------- amounts

test("gross amounts parse into minor units either way Midtrans quotes them", () => {
  assert.equal(midtrans.grossAmountToMinor("149000.00"), 14_900_000);
  assert.equal(midtrans.grossAmountToMinor("149000"), 14_900_000);
  assert.equal(midtrans.grossAmountToMinor("0"), 0);
});

test("a malformed gross amount parses to null, never to a number", () => {
  for (const value of ["", "abc", "-1000", "1e5", "149.000,00"]) {
    assert.equal(midtrans.grossAmountToMinor(value), null, `${value} must not parse`);
  }
});

test("only whole rupiah can be charged", () => {
  assert.equal(midtrans.minorToGrossAmount(14_900_000), 149_000);
  // Rp 1.499,50 would be rounded by Midtrans, and the rounded amount would then
  // fail the webhook's equality check against what we billed.
  assert.throws(() => midtrans.minorToGrossAmount(149_950), /whole rupiah/);
  assert.throws(() => midtrans.minorToGrossAmount(0), /whole rupiah/);
  assert.throws(() => midtrans.minorToGrossAmount(-100), /whole rupiah/);
});

test("the provider order id is derived from the order, not invented", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  assert.equal(midtrans.buildProviderOrderId(id), `ARENA-STORE-${id}`);
});

test("the provider order id fits Midtrans and can never collide with the main site", () => {
  const id = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  const orderId = midtrans.buildProviderOrderId(id);
  // Snap: at most 50 characters of alphanumerics and . _ ~ -
  assert.ok(orderId.length <= 50, `${orderId.length} characters`);
  assert.match(orderId, /^[A-Za-z0-9._~-]+$/);
  // The main site shares the merchant and mints SK-<hex>-<base36>.
  assert.ok(!orderId.startsWith("SK-"));
});

// ----------------------------------------------------------- points ledger

test("a shop purchase counts as points spent, not points earned", () => {
  const totals = accounting.summarizePoints([
    { amount: 1000, entryType: "WEEKLY_RANK", referenceType: null },
    { amount: -400, entryType: "STORE_PURCHASE", referenceType: "store_order" },
  ]);
  assert.equal(totals.balance, 600);
  assert.equal(totals.lifetimeEarned, 1000);
  assert.equal(totals.lifetimeSpent, 400);
});

test("a shop refund lowers what was spent instead of inflating what was earned", () => {
  // The wrong branch here would let anyone raise their lifetime earned total by
  // buying something and asking for their points back.
  const totals = accounting.summarizePoints([
    { amount: 1000, entryType: "WEEKLY_RANK", referenceType: null },
    { amount: -400, entryType: "STORE_PURCHASE", referenceType: "store_order" },
    { amount: 400, entryType: "STORE_REFUND", referenceType: "store_order" },
  ]);
  assert.equal(totals.balance, 1000);
  assert.equal(totals.lifetimeEarned, 1000);
  assert.equal(totals.lifetimeSpent, 0);
});

test("shop and reward spending share one wallet", () => {
  const totals = accounting.summarizePoints([
    { amount: 2000, entryType: "WEEKLY_RANK", referenceType: null },
    { amount: -300, entryType: "REWARD_REDEMPTION", referenceType: "redemption" },
    { amount: -500, entryType: "STORE_PURCHASE", referenceType: "store_order" },
  ]);
  assert.equal(totals.balance, 1200);
  assert.equal(totals.lifetimeSpent, 800);
});
