import assert from "node:assert/strict";
import test from "node:test";
import { sendArenaEmail } from "../src/server/notifications/email.ts";
import { emailContent, retryAt, retryExpired } from "../src/server/notifications/outbox-policy.ts";

test("email transport sends stable idempotency key and requires a provider receipt", async () => {
  const message = { from: "Arena <hello@example.com>", to: "person@example.com", subject: "Result", html: "<p>Done</p>", text: "Done" };
  const options = { apiKey: "fake", idempotencyKey: "arena-email/uuid", fetcher: async (_url, init) => {
    assert.equal(init.headers["Idempotency-Key"], "arena-email/uuid");
    assert.equal(JSON.parse(init.body).from, message.from);
    return Response.json({ id: "provider-1" });
  } };
  assert.deepEqual(await sendArenaEmail(message, options), { ok: true, id: "provider-1" });
  assert.equal((await sendArenaEmail(message, { ...options, fetcher: async () => Response.json({}) })).ok, false);
  assert.deepEqual(await sendArenaEmail(message, { apiKey: "", fetcher: () => { throw Error("must not send"); } }), { ok: true, skipped: true });
});

test("email content escapes HTML and only resolves local destination links", () => {
  const body = '<img src=x onerror="bad()"> & reward';
  const content = emailContent({ body, actionUrl: "/app/profile" }, "https://arena.example.com");
  assert.ok(!content.html.includes("<img"));
  assert.match(content.html, /&lt;img/);
  assert.match(content.html, /href="https:\/\/arena.example.com\/app\/profile"/);
  assert.match(content.text, /https:\/\/arena.example.com\/app\/profile/);
  for (const actionUrl of ["https://attacker.test", "//attacker.test", "/\\attacker.test", "javascript:alert(1)"]) {
    assert.ok(!emailContent({ body, actionUrl }, "https://arena.example.com").html.includes("href="));
  }
});

test("a digital reward's link is only clickable when its host is allowed", () => {
  const body = "Klaim kamu sudah diproses.";
  const origin = "https://arena.example.com";
  const delivered = emailContent({ body, actionUrl: "https://kit.notion.site/job-hunt" }, origin);
  assert.match(delivered.html, /href="https:\/\/kit\.notion\.site\/job-hunt"/);
  assert.match(delivered.text, /https:\/\/kit\.notion\.site\/job-hunt/);
  for (const actionUrl of [
    "http://kit.notion.site/job-hunt",              // plaintext transport
    "https://notion.site.attacker.test/job-hunt",   // allowed host as a prefix of another
    "https://user:pass@kit.notion.site/job-hunt",   // credentials in the URL
    "https://kit.example.com/job-hunt",             // simply not on the list
  ]) {
    const content = emailContent({ body, actionUrl }, origin);
    assert.ok(!content.html.includes("href="), actionUrl);
    // The address still reaches the participant, as text they read first.
    assert.equal(content.text, body);
  }
  // The list is configurable, and an explicit one replaces the default.
  assert.match(emailContent({ body, actionUrl: "https://kit.example.com/x" }, origin, ["example.com"]).html, /href=/);
  assert.ok(!emailContent({ body, actionUrl: "https://kit.notion.site/x" }, origin, ["example.com"]).html.includes("href="));
});

test("retry backoff is bounded and stops before provider idempotency expiry", () => {
  const now = new Date("2026-09-06T00:00:00Z");
  assert.equal(retryAt(1, now).getTime() - now.getTime(), 5 * 60_000);
  assert.equal(retryAt(2, now).getTime() - now.getTime(), 15 * 60_000);
  assert.equal(retryExpired(now, new Date(now.getTime() + 22 * 3600_000)), false);
  assert.equal(retryExpired(now, new Date(now.getTime() + 23 * 3600_000)), true);
});
