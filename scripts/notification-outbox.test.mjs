import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { notify, broadcastWeekNotification } from "../src/server/notifications/service.ts";
import { claimEmail, flushPendingEmails } from "../src/server/notifications/outbox.ts";
import { users, weeks, divisions, projects, enrollments, events } from "../src/server/db/schema/index.ts";
import { and, eq } from "drizzle-orm";

nextEnv.loadEnvConfig(process.cwd());
assert.ok(["development", "test"].includes(process.env.APP_ENV), "Outbox fixtures require a non-production database");
const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const db = drizzle({ client: sql });
after(() => sql.end({ timeout: 5 }));

async function fixture(t, options = {}) {
  const [user] = await sql`insert into identity.users (auth_subject, email_cache) values (${`outbox-${randomUUID()}`}, 'fixture@example.invalid') returning id`;
  t.after(async () => {
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${user.id})`;
    await sql`delete from notifications.events where user_id = ${user.id}`;
    await sql`delete from identity.users where id = ${user.id}`;
  });
  const input = { type: "RESULT_READY", userId: user.id, title: "Fixture", body: "<result>", actionUrl: "/app/profile", ...options };
  const event = await notify(input, db);
  const [delivery] = await sql`select id from notifications.deliveries where event_id = ${event.eventId} and channel = 'EMAIL'`;
  return { user, input, event, id: delivery.id };
}

test("event and deliveries are atomic and duplicate product notices are suppressed", async (t) => {
  const row = await fixture(t, { dedupeKey: `fixture-${randomUUID()}` });
  const repeated = await notify(row.input, db);
  assert.equal(repeated.created, false);
  assert.equal(repeated.eventId, row.event.eventId);
  const [{ n }] = await sql`select count(*)::int n from notifications.deliveries where event_id = ${repeated.eventId}`;
  assert.equal(n, 2);
  await assert.rejects(() => notify({ ...row.input, dedupeKey: undefined, channels: ["INVALID"] }, db));
  const [events] = await sql`select count(*)::int n from notifications.events where user_id = ${row.user.id}`;
  assert.equal(events.n, 1, "invalid delivery must roll back its event");
});

test("failed email waits for backoff then retries identical payload and key", async (t) => {
  const row = await fixture(t);
  let now = new Date(Date.now() + 1000);
  const sent = [];
  const sender = async (message, options) => {
    sent.push({ message, options });
    return sent.length === 1 ? { ok: false, error: "timeout" } : { ok: true, id: "receipt" };
  };
  const flush = () => flushPendingEmails({ db, deliveryId: row.id, now: () => now, sender });
  assert.equal((await flush()).failed, 1);
  assert.equal((await flush()).sent, 0);
  await sql`update identity.users set email_cache = 'changed@example.invalid' where id = ${row.user.id}`;
  now = new Date(now.getTime() + 6 * 60_000);
  assert.equal((await flush()).sent, 1);
  assert.deepEqual(sent[0], sent[1]);
  assert.equal((await flush()).sent, 0);
});

test("concurrent claims are exclusive and expired leases recover with the same snapshot", async (t) => {
  const row = await fixture(t);
  const now = new Date(Date.now() + 1000);
  const claims = await Promise.all([claimEmail(db, now, row.id), claimEmail(db, now, row.id)]);
  assert.equal(claims.filter(Boolean).length, 1);
  const first = claims.find(Boolean);
  const recovered = await claimEmail(db, new Date(now.getTime() + 61_000), row.id);
  assert.notEqual(recovered.token, first.token);
  assert.deepEqual(recovered.message, first.message);
  assert.equal(recovered.attempt, 2);
});

test("expired idempotency window holds for reconciliation without sending", async (t) => {
  const row = await fixture(t);
  const now = new Date(Date.now() + 1000);
  await claimEmail(db, now, row.id);
  const result = await flushPendingEmails({ db, deliveryId: row.id, now: () => new Date(now.getTime() + 24 * 3600_000), sender: async () => { throw Error("must not send"); } });
  assert.equal(result.held, 1);
  const [delivery] = await sql`select status, error_code from notifications.deliveries where id = ${row.id}`;
  assert.equal(delivery.status, "FAILED");
  assert.equal(delivery.error_code, "IDEMPOTENCY_WINDOW_EXPIRED");
});

test("stale worker cannot acknowledge a reassigned lease", async (t) => {
  const row = await fixture(t);
  const now = new Date(Date.now() + 1000);
  const result = await flushPendingEmails({ db, deliveryId: row.id, now: () => now, sender: async () => {
    await sql`update notifications.deliveries set lease_token = ${randomUUID()} where id = ${row.id}`;
    return { ok: true, id: "stale-receipt" };
  } });
  assert.equal(result.sent, 0);
  assert.equal(result.held, 1);
  const [delivery] = await sql`select status, provider_reference from notifications.deliveries where id = ${row.id}`;
  assert.equal(delivery.status, "PENDING");
  assert.equal(delivery.provider_reference, null);
});

test("project drops reach historical participants; reminders exclude submitted and suspended users", async () => {
  const rollback = new Error("fixture rollback");
  await assert.rejects(() => db.transaction(async (tx) => {
    const stamp = randomUUID();
    const now = new Date();
    const [past] = await tx.insert(weeks).values({ weekCode: `past-${stamp}`, title: "Past", status: "FINALIZED", opensAt: new Date(now.getTime() - 14 * 86400_000), submissionDeadlineAt: new Date(now.getTime() - 7 * 86400_000) }).returning();
    const [week] = await tx.insert(weeks).values({ weekCode: `current-${stamp}`, title: "Current", status: "OPEN", opensAt: new Date(now.getTime() - 86400_000), submissionDeadlineAt: new Date(now.getTime() + 3600_000) }).returning();
    const [division] = await tx.insert(divisions).values({ slug: stamp, name: "Fixture" }).returning();
    const [oldProject, currentProject] = await tx.insert(projects).values([past, week].map((w) => ({ weekId: w.id, divisionId: division.id, slug: `p-${w.id}`, title: "Fixture", status: "PUBLISHED" }))).returning();
    const members = await tx.insert(users).values(["old", "active", "submitted", "suspended"].map((label) => ({ authSubject: `${label}-${stamp}`, status: label === "suspended" ? "SUSPENDED" : "ACTIVE" }))).returning();
    await tx.insert(enrollments).values(members.map((u, i) => ({ userId: u.id, weekId: i === 0 ? past.id : week.id, projectId: i === 0 ? oldProject.id : currentProject.id, status: i === 2 ? "SUBMITTED" : "ACTIVE" })));
    const input = { weekId: week.id, type: "PROJECT_DROP", title: "Drop", body: "Fixture", now };
    await broadcastWeekNotification(input, tx);
    await broadcastWeekNotification(input, tx);
    for (let i = 0; i < members.length; i++) {
      const rows = await tx.select().from(events).where(and(eq(events.weekId, week.id), eq(events.userId, members[i].id)));
      assert.equal(rows.length, i === 3 ? 0 : 1);
    }
    await broadcastWeekNotification({ ...input, type: "DEADLINE_REMINDER" }, tx);
    const reminders = await tx.select().from(events).where(and(eq(events.weekId, week.id), eq(events.type, "DEADLINE_REMINDER")));
    assert.deepEqual(reminders.map((e) => e.userId), [members[1].id]);
    await tx.update(weeks).set({ status: "CLOSED" }).where(eq(weeks.id, week.id));
    await assert.rejects(() => broadcastWeekNotification(input, tx), (error) => error.code === "WEEK_NOT_READY");
    throw rollback;
  }), (error) => error === rollback);
});
