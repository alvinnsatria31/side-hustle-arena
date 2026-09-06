import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { notify } from "../src/server/notifications/service.ts";
import { claimEmail } from "../src/server/notifications/outbox.ts";
import { MAX_EMAIL_ATTEMPTS } from "../src/server/notifications/outbox-policy.ts";
import {
  cancelEmailDelivery,
  countStaleLeases,
  listEmailOutbox,
  listHeldForReconciliation,
  requeueEmailDelivery,
  summarizeEmailOutbox,
} from "../src/server/notifications/outbox-admin.ts";

nextEnv.loadEnvConfig(process.cwd());
assert.ok(["development", "test"].includes(process.env.APP_ENV), "Outbox fixtures require a non-production database");
const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const db = drizzle({ client: sql });
after(() => sql.end({ timeout: 5 }));

const ACTOR = "admin-outbox-test";

async function fixture(t, patch = {}) {
  const [user] = await sql`
    insert into identity.users (auth_subject, email_cache)
    values (${`outbox-admin-${randomUUID()}`}, 'fixture@example.invalid') returning id`;
  t.after(async () => {
    await sql`delete from audit.logs where actor_subject = ${ACTOR} and entity_id in (
      select d.id::text from notifications.deliveries d
      join notifications.events e on e.id = d.event_id where e.user_id = ${user.id})`;
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${user.id})`;
    await sql`delete from notifications.events where user_id = ${user.id}`;
    await sql`delete from identity.users where id = ${user.id}`;
  });
  const event = await notify(
    { type: "RESULT_READY", userId: user.id, title: "Fixture", body: "hasil siap", actionUrl: "/app/profile" },
    db,
  );
  const [delivery] = await sql`
    select id from notifications.deliveries where event_id = ${event.eventId} and channel = 'EMAIL'`;
  // postgres.js cannot infer a type for a bare Date in the `sql(object)` helper.
  const columns = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  );
  if (Object.keys(columns).length) await sql`update notifications.deliveries set ${sql(columns)} where id = ${delivery.id}`;
  return { userId: user.id, id: delivery.id };
}

/** The console must never claim a row is due when the worker would refuse it. */
async function bucketOf(id, now) {
  for (const bucket of ["due", "backingOff", "inFlight", "held", "skipped", "sent"]) {
    const rows = await listEmailOutbox({ bucket, offset: 0, limit: 100 }, { now }, db);
    if (rows.some((row) => row.id === id)) return bucket;
  }
  return null;
}

test("every bucket agrees with what the worker actually does to that row", async (t) => {
  // Every scenario pins its own `available_at` rather than inheriting the
  // insert-time default, so the assertions cannot race the database clock.
  const now = new Date();
  const ready = new Date(now.getTime() - 1000);

  const due = await fixture(t, { available_at: ready });
  assert.equal(await bucketOf(due.id, now), "due");
  const dueClaim = await claimEmail(db, now, due.id);
  assert.ok(dueClaim?.id, "a due row must actually be claimable");

  const backingOff = await fixture(t, { available_at: new Date(now.getTime() + 3600_000) });
  assert.equal(await bucketOf(backingOff.id, now), "backingOff");
  assert.equal(await claimEmail(db, now, backingOff.id), null, "a backing-off row must not be claimable yet");

  // Two different roads to the same terminal state, and the bucket must cover both.
  // Attempts exhausted with no lease falls out of the claim predicate entirely —
  // the worker never selects it again, so it reports nothing at all.
  const exhausted = await fixture(t, { available_at: ready, attempt_count: MAX_EMAIL_ATTEMPTS, status: "FAILED" });
  assert.equal(await bucketOf(exhausted.id, now), "held");
  assert.equal(await claimEmail(db, now, exhausted.id), null, "an exhausted row is never picked up again");

  // A closed idempotency window is still selectable, so the worker picks it up
  // and parks it as held without sending.
  const expired = await fixture(t, { available_at: ready, attempt_count: 1, first_attempt_at: new Date(now.getTime() - 24 * 3600_000) });
  assert.equal(await bucketOf(expired.id, now), "held", "a closed idempotency window is terminal too");
  assert.deepEqual(await claimEmail(db, now, expired.id), { held: true });

  const leased = await fixture(t, { available_at: ready, lease_token: randomUUID(), lease_expires_at: new Date(now.getTime() + 60_000) });
  assert.equal(await bucketOf(leased.id, now), "inFlight");
  assert.equal(await claimEmail(db, now, leased.id), null, "a live lease must not be stolen");

  const skipped = await fixture(t, { available_at: ready, status: "SKIPPED", error_code: "NO_EMAIL_ON_FILE" });
  assert.equal(await bucketOf(skipped.id, now), "skipped");
  assert.equal(await claimEmail(db, now, skipped.id), null);

  const sent = await fixture(t, { available_at: ready, status: "SENT", provider_reference: "receipt-1", sent_at: now });
  assert.equal(await bucketOf(sent.id, now), "sent");
  assert.equal(await claimEmail(db, now, sent.id), null);
});

test("requeue returns a held row to the queue, keeps the frozen payload, and is audited", async (t) => {
  const snapshot = { from: "a@example.invalid", to: "b@example.invalid", subject: "Beku", html: "<p>beku</p>", text: "beku" };
  const now = new Date();
  const row = await fixture(t, {
    status: "FAILED",
    available_at: new Date(now.getTime() - 1000),
    attempt_count: MAX_EMAIL_ATTEMPTS,
    error_code: "ATTEMPTS_EXHAUSTED",
    first_attempt_at: new Date(now.getTime() - 2 * 3600_000),
  });
  // jsonb is written as cast text: the driver has no column type to infer from here.
  await sql`update notifications.deliveries set message_snapshot = ${JSON.stringify(snapshot)}::jsonb where id = ${row.id}`;
  assert.equal(await bucketOf(row.id, now), "held");

  const result = await requeueEmailDelivery({ deliveryId: row.id, reason: "provider outage resolved", actorSubject: ACTOR, now, db });
  assert.equal(result.status, "PENDING");

  const [after] = await sql`select * from notifications.deliveries where id = ${row.id}`;
  assert.equal(after.attempt_count, 0);
  assert.equal(after.first_attempt_at, null, "the idempotency clock must restart");
  assert.equal(after.error_code, null);
  assert.deepEqual(after.message_snapshot, snapshot, "the frozen payload must survive a requeue");
  assert.equal(await bucketOf(row.id, new Date(now.getTime() + 1000)), "due");

  const claim = await claimEmail(db, new Date(now.getTime() + 1000), row.id);
  assert.deepEqual(claim.message, snapshot, "the retry must send the same message the first attempt froze");

  const [audit] = await sql`
    select action, metadata from audit.logs where entity_id = ${row.id} and action = 'EMAIL_DELIVERY_REQUEUED'`;
  assert.equal(audit.metadata.reason, "provider outage resolved");
  assert.equal(audit.metadata.previousErrorCode, "ATTEMPTS_EXHAUSTED");
});

test("operator actions refuse to race a live worker or touch a delivered email", async (t) => {
  const now = new Date();
  const leased = await fixture(t, { lease_token: randomUUID(), lease_expires_at: new Date(now.getTime() + 60_000) });
  await assert.rejects(
    () => requeueEmailDelivery({ deliveryId: leased.id, reason: "impatient", actorSubject: ACTOR, now, db }),
    /being sent right now/,
  );
  await assert.rejects(
    () => cancelEmailDelivery({ deliveryId: leased.id, reason: "impatient", actorSubject: ACTOR, now, db }),
    /being sent right now/,
  );

  const delivered = await fixture(t, { status: "SENT", provider_reference: "receipt-2", sent_at: now });
  await assert.rejects(
    () => requeueEmailDelivery({ deliveryId: delivered.id, reason: "resend it", actorSubject: ACTOR, now, db }),
    /cannot be requeued/,
  );

  await assert.rejects(
    () => requeueEmailDelivery({ deliveryId: randomUUID(), reason: "ghost", actorSubject: ACTOR, now, db }),
    /not found/,
  );
  await assert.rejects(
    () => requeueEmailDelivery({ deliveryId: leased.id, reason: "no actor", actorSubject: "  ", now, db }),
    /Actor is required/,
  );
});

test("cancel stops the worker for good and records why", async (t) => {
  const row = await fixture(t, { status: "FAILED", attempt_count: 2, error_code: "timeout" });
  const now = new Date();
  const result = await cancelEmailDelivery({ deliveryId: row.id, reason: "peserta minta berhenti", actorSubject: ACTOR, now, db });
  assert.equal(result.status, "SKIPPED");

  const [after] = await sql`select status, error_code from notifications.deliveries where id = ${row.id}`;
  assert.equal(after.status, "SKIPPED");
  assert.equal(after.error_code, "ADMIN_CANCELLED");
  assert.equal(await claimEmail(db, new Date(now.getTime() + 1000), row.id), null, "a cancelled row must never be claimed again");
  assert.equal(await bucketOf(row.id, now), "skipped");

  const [audit] = await sql`
    select metadata from audit.logs where entity_id = ${row.id} and action = 'EMAIL_DELIVERY_CANCELLED'`;
  assert.equal(audit.metadata.reason, "peserta minta berhenti");
});

test("summary counts the queue and surfaces reconciliation work", async (t) => {
  const now = new Date();
  const before = await summarizeEmailOutbox({ now }, db);
  const staleBefore = await countStaleLeases({ now }, db);

  const held = await fixture(t, { status: "FAILED", attempt_count: MAX_EMAIL_ATTEMPTS, error_code: "ATTEMPTS_EXHAUSTED" });
  await fixture(t, { lease_token: randomUUID(), lease_expires_at: new Date(now.getTime() - 1000) });
  await fixture(t, { status: "SENT", sent_at: now });

  const after = await summarizeEmailOutbox({ now }, db);
  assert.equal(after.counts.held - before.counts.held, 1);
  assert.equal(after.staleLeases - staleBefore, 1, "an expired lease is reconciliation work, not a bucket");
  assert.equal(
    after.anomalies.sentWithoutReceipt - before.anomalies.sentWithoutReceipt,
    1,
    "SENT without a provider receipt breaks the writer's invariant and must be flagged, not retried",
  );
  assert.equal(after.senderConfigured, Boolean(process.env.RESEND_API_KEY));

  const reconciliation = await listHeldForReconciliation({ now, limit: 100 }, db);
  assert.ok(reconciliation.some((row) => row.id === held.id));
  assert.ok(reconciliation.every((row) => row.bucket === "held"));
  assert.ok(!("html" in reconciliation[0]), "the console must not select the rendered message body");
});
