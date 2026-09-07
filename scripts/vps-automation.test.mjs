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
