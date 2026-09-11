import assert from "node:assert/strict";
import test from "node:test";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const vps = await import("../src/server/automation/vps-hooks.ts");
const email = await import("../src/server/notifications/email.ts");
const milestones = await import("../src/server/rewards/milestones.ts");
const voucher = await import("../src/server/rewards/voucher-push.ts");

test("VPS webhook skips loudly without a token and never throws", async () => {
  const saved = process.env.VPS_WEBHOOK_TOKEN;
  try {
    delete process.env.VPS_WEBHOOK_TOKEN;
    const result = await vps.sendVpsWebhook("arena-submit", { version_id: "x" });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
    // Fire-and-forget wrapper swallows everything by contract.
    vps.notifyVps("arena-submit", { version_id: "x" });
  } finally {
    if (saved === undefined) delete process.env.VPS_WEBHOOK_TOKEN;
    else process.env.VPS_WEBHOOK_TOKEN = saved;
  }
});

test("VPS webhook reports delivery failure instead of throwing", async () => {
  const saved = process.env.VPS_WEBHOOK_TOKEN;
  try {
    process.env.VPS_WEBHOOK_TOKEN = "test-token";
    const failing = async () => {
      throw new Error("VPS down");
    };
    const result = await vps.sendVpsWebhook("arena-submit", {}, failing);
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /VPS down/);
  } finally {
    if (saved === undefined) delete process.env.VPS_WEBHOOK_TOKEN;
    else process.env.VPS_WEBHOOK_TOKEN = saved;
  }
});

test("VPS webhook refuses bearer delivery over non-legacy plain HTTP", async () => {
  const savedToken = process.env.VPS_WEBHOOK_TOKEN;
  const savedBase = process.env.VPS_WEBHOOK_BASE_URL;
  try {
    process.env.VPS_WEBHOOK_TOKEN = "test-token";
    process.env.VPS_WEBHOOK_BASE_URL = "http://example.com/webhook";
    let called = false;
    const result = await vps.sendVpsWebhook("arena-submit", {}, async () => {
      called = true;
      throw new Error("must not be called");
    });
    assert.equal(result.ok, false);
    assert.equal(called, false, "token must never leave over plain HTTP to a custom host");
    assert.match(result.error ?? "", /HTTPS/);
  } finally {
    if (savedToken === undefined) delete process.env.VPS_WEBHOOK_TOKEN;
    else process.env.VPS_WEBHOOK_TOKEN = savedToken;
    if (savedBase === undefined) delete process.env.VPS_WEBHOOK_BASE_URL;
    else process.env.VPS_WEBHOOK_BASE_URL = savedBase;
  }
});

test("email sender distinguishes skipped (no key) from sent and failed", async () => {
  const saved = process.env.RESEND_API_KEY;
  try {
    delete process.env.RESEND_API_KEY;
    const skipped = await email.sendArenaEmail({ to: "a@example.com", subject: "s", html: "<p>h</p>", text: "t" });
    assert.deepEqual(skipped, { ok: true, skipped: true });

    process.env.RESEND_API_KEY = "test-key";
    const sent = await email.sendArenaEmail(
      { to: "a@example.com", subject: "s", html: "<p>h</p>", text: "t" },
      { fetcher: async () => new Response(JSON.stringify({ id: "mail-1" }), { status: 200 }) },
    );
    assert.deepEqual(sent, { ok: true, id: "mail-1" });

    const failed = await email.sendArenaEmail(
      { to: "a@example.com", subject: "s", html: "<p>h</p>", text: "t" },
      { fetcher: async () => new Response("no", { status: 401 }) },
    );
    assert.equal(failed.ok, false);
  } finally {
    if (saved === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = saved;
  }
});

test("milestone ladder derives locked/ready/taken from ledger math, never stored flags", () => {
  const catalog = [
    { slug: "a", title: "A", pointsCost: 300 },
    { slug: "b", title: "B", pointsCost: 600 },
  ];
  const poor = milestones.computeLadderState({ lifetimePoints: 100, catalog, takenSlugs: new Set(), takenAt: new Map() });
  assert.deepEqual(poor.steps.map((step) => step.state), ["locked", "locked"]);
  assert.equal(poor.next?.slug, "a");
  assert.equal(poor.readyCount, 0);

  const rich = milestones.computeLadderState({ lifetimePoints: 650, catalog, takenSlugs: new Set(["a"]), takenAt: new Map([["a", "2026-09-04"]]) });
  assert.deepEqual(rich.steps.map((step) => step.state), ["taken", "ready"]);
  assert.equal(rich.steps[1].deficit, 0);
  assert.equal(rich.steps[0].takenAt, "2026-09-04");
  assert.equal(rich.readyCount, 1);
  assert.equal(rich.takenCount, 1);
  assert.equal(rich.next, null);
});

test("ladder flags empty stock and hands over the retryOf a repeat claim must name", () => {
  const catalog = [
    { slug: "a", title: "A", pointsCost: 100 },
    { slug: "b", title: "B", pointsCost: 200 },
    { slug: "c", title: "C", pointsCost: 900 },
  ];
  const ladder = milestones.computeLadderState({
    lifetimePoints: 300, catalog, takenSlugs: new Set(), takenAt: new Map(),
    retryOf: new Map([["a", "claim-2"]]), outOfStockSlugs: new Set(["b", "c"]),
  });
  assert.deepEqual(ladder.steps.map((step) => step.state), ["ready", "out_of_stock", "locked"]);
  assert.deepEqual(ladder.steps.map((step) => step.outOfStock), [false, true, true]);
  assert.equal(ladder.steps[0].retryOf, "claim-2");
  assert.equal(ladder.readyCount, 1);
  // An unreached reward keeps its points gap even with an empty shelf.
  assert.equal(ladder.steps[2].deficit, 600);
  assert.equal(ladder.next?.slug, "c");

  // A held claim is the participant's whatever the stock, and has nothing to retry.
  const held = milestones.computeLadderState({
    lifetimePoints: 300, catalog, takenSlugs: new Set(["b"]), takenAt: new Map([["b", "2026-09-11"]]),
    retryOf: new Map([["b", "old-claim"]]), outOfStockSlugs: new Set(["b"]),
  });
  assert.equal(held.steps[1].state, "taken");
  assert.equal(held.steps[1].outOfStock, false);
  assert.equal(held.steps[1].retryOf, null);
});

test("reward claims classify exactly the way claimRedemption decides", () => {
  const at = (minute) => new Date(Date.UTC(2026, 8, 11, 0, minute));
  const take = (id, status, minute, over = {}) => ({ id, status, redeemedAt: at(minute), idempotencyKey: "take:user:reward", inventoryPeriodId: null, ...over });
  const keys = (...entries) => new Set(entries);
  const classify = milestones.classifyRewardTakes;

  assert.deepEqual(classify([], keys()), { heldAt: null, retryOf: null });
  // An active claim holds the reward.
  assert.deepEqual(classify([take("a", "PENDING", 1)], keys("redemption:a:debit")), { heldAt: at(1), retryOf: null });
  // A refunded claim is retried by naming it.
  assert.deepEqual(classify([take("a", "ADMIN_REVERSED", 1)], keys("redemption:a:debit", "redemption:a:refund")), { heldAt: null, retryOf: "a" });
  // Once a retry was refunded too, only the newest claim may be named — the
  // older one already has a retry keyed to it — even if the clock says otherwise.
  const chain = [
    take("a", "ADMIN_REVERSED", 5),
    take("b", "ADMIN_REVERSED", 5, { idempotencyKey: "take:user:reward:retry:a" }),
  ];
  const settled = keys("redemption:a:debit", "redemption:a:refund", "redemption:b:debit", "redemption:b:refund");
  assert.deepEqual(classify(chain, settled), { heldAt: null, retryOf: "b" });
  // A failed claim still holding its debit, or a stock reservation, blocks until an admin reverses it.
  assert.deepEqual(classify([take("a", "FAILED", 1)], keys("redemption:a:debit")), { heldAt: at(1), retryOf: null });
  assert.deepEqual(classify([take("a", "FAILED", 1, { inventoryPeriodId: "period" })], keys()), { heldAt: at(1), retryOf: null });
  // A refund after fulfilment keeps the consumed stock and still settles the claim.
  assert.deepEqual(
    classify([take("a", "ADMIN_REVERSED", 1, { inventoryPeriodId: "period" })], keys("redemption:a:debit", "redemption:a:refund")),
    { heldAt: null, retryOf: "a" },
  );
});

test("crossed thresholds only fire on the boundary crossed by this award", () => {
  assert.deepEqual(milestones.crossedThresholds(0, 300, [150, 300, 600]), [150, 300]);
  assert.deepEqual(milestones.crossedThresholds(300, 100, [150, 300, 600]), []);
  assert.deepEqual(milestones.crossedThresholds(590, 20, [600]), [600]);
});

test("voucher push reports missing redemption and pending contract without throwing", async () => {
  const savedOrigin = process.env.MAIN_SITE_ORIGIN;
  const savedToken = process.env.MAIN_SITE_VOUCHER_TOKEN;
  try {
    delete process.env.MAIN_SITE_ORIGIN;
    delete process.env.MAIN_SITE_VOUCHER_TOKEN;
    // `db` is injected rather than left to default to getDb(). This test used to
    // reach the real database for a UUID that happens not to exist, so it passed
    // wherever DATABASE_URL pointed at something live and failed in CI, where it
    // does not — a green run for the wrong reason. A missing redemption is a
    // pure branch and needs no Postgres to prove.
    const noRows = { select: () => ({ from: () => ({ where: async () => [] }) }) };
    const refuse = () => { throw new Error("a missing redemption must never reach the main site"); };
    const missing = await voucher.pushRewardCode("0d224c11-a09f-41dd-8c7c-63484e7f7a0b", refuse, noRows);
    assert.deepEqual(missing, { ok: false, pushable: false, error: "Redemption not found." });
  } finally {
    if (savedOrigin !== undefined) process.env.MAIN_SITE_ORIGIN = savedOrigin;
    if (savedToken !== undefined) process.env.MAIN_SITE_VOUCHER_TOKEN = savedToken;
  }
});
