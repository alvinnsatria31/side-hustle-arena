/**
 * The unified admin's write contract, against a real database.
 *
 * Every action that so far only Arena's own console offered — suspending an
 * account, stock and reward settings, order fulfil/cancel/points refund, the
 * emergency switches, enrolment void, rubric authoring, project regenerate and
 * cover, the email outbox, product file upload — is called here exactly as the
 * central panel calls it: through the real route handler, with the central
 * admin's own bearer, on isolated fixtures. Each case checks the response the
 * panel will parse, the row it changed, and the audit entry under the panel's
 * configured subject.
 *
 * Nothing here reaches a model, a payment provider, the main site's voucher API
 * or an email provider: the sandbox environment blanks every one of those keys,
 * and the assertions below prove the paths that would call them stop short.
 *
 * Needs the local sandbox (Postgres + MinIO). Excluded from
 * `npm run test:offline` automatically because it reads DATABASE_URL.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { localEnvironment } from "./local-env.mjs";

const sandbox = localEnvironment();
for (const [key, value] of Object.entries(sandbox)) process.env[key] = value;
assert.equal(process.env.ARENA_LOCAL_SANDBOX, "1");
assert.match(process.env.DATABASE_URL, /127\.0\.0\.1|localhost/);
for (const key of ["AI_API_KEY", "MAIN_SITE_VOUCHER_TOKEN", "RESEND_API_KEY"]) {
  assert.ok(!process.env[key], `${key} must be blank so nothing external can be reached`);
}

const TOKEN = randomBytes(32).toString("hex");
const SUBJECT = "central-admin:contract-integration";
const PANEL_SCOPES = "overview,reviews,weeks,projects,rewards,users,store";
Object.assign(process.env, { CENTRAL_ADMIN_TOKEN: TOKEN, CENTRAL_ADMIN_SUBJECT: SUBJECT, CENTRAL_ADMIN_SCOPES: PANEL_SCOPES });

const { getDb } = await import("../src/server/db/client.ts");
const schema = await import("../src/server/db/schema/index.ts");
const { and, eq, inArray } = await import("drizzle-orm");
const route = (path) => import(`../src/app/api/internal/${path}/route.ts`);

const db = getDb();
const STAMP = `ua-it-${Date.now()}-${randomUUID().slice(0, 6)}`;
const fixture = { userIds: [], productIds: [], orderIds: [], rewardIds: [], weekIds: [], divisionIds: [], projectIds: [], versionIds: [], reviewIds: [], flag: null };

function call(handler, path, { method = "POST", body, params = {}, token = TOKEN } = {}) {
  const request = new Request(`http://127.0.0.1:3001${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return handler(request, { params: Promise.resolve(params) }).then(async (response) => ({ status: response.status, json: await response.json() }));
}

async function auditFor(entityId, action) {
  return db.select().from(schema.logs).where(and(eq(schema.logs.entityId, String(entityId)), eq(schema.logs.action, action)));
}

async function user(label) {
  const [row] = await db.insert(schema.users).values({ authSubject: `${STAMP}-${label}`, displayNameCache: `${STAMP} ${label}`, emailCache: `${label}@example.test` }).returning();
  fixture.userIds.push(row.id);
  return row;
}

before(async () => {
  const [flag] = await db.select().from(schema.featureFlags).where(eq(schema.featureFlags.key, "arena-publish"));
  fixture.flag = flag ?? null;
});

after(async () => {
  // Restore the one shared switch first: other sandbox suites read it.
  if (fixture.flag) {
    await db.update(schema.featureFlags).set({ maintenanceMode: fixture.flag.maintenanceMode, message: fixture.flag.message }).where(eq(schema.featureFlags.key, "arena-publish"));
  } else {
    await db.delete(schema.featureFlags).where(eq(schema.featureFlags.key, "arena-publish"));
  }
  // audit.logs is append-only by design and keeps its rows; everything else goes.
  const steps = [
    () => fixture.orderIds.length && db.delete(schema.entitlements).where(inArray(schema.entitlements.orderId, fixture.orderIds)),
    () => fixture.orderIds.length && db.delete(schema.orders).where(inArray(schema.orders.id, fixture.orderIds)),
    () => fixture.productIds.length && db.delete(schema.products).where(inArray(schema.products.id, fixture.productIds)),
    () => fixture.rewardIds.length && db.delete(schema.inventoryPeriods).where(inArray(schema.inventoryPeriods.rewardId, fixture.rewardIds)),
    () => fixture.rewardIds.length && db.delete(schema.catalog).where(inArray(schema.catalog.id, fixture.rewardIds)),
    () => fixture.weekIds.length && db.delete(schema.weeklyRankings).where(inArray(schema.weeklyRankings.weekId, fixture.weekIds)),
    () => fixture.weekIds.length && db.delete(schema.skillEvidence).where(inArray(schema.skillEvidence.weekId, fixture.weekIds)),
    () => fixture.reviewIds.length && db.delete(schema.reviews).where(inArray(schema.reviews.id, fixture.reviewIds)),
    () => fixture.versionIds.length && db.delete(schema.submissionVersions).where(inArray(schema.submissionVersions.id, fixture.versionIds)),
    () => fixture.weekIds.length && db.delete(schema.submissions).where(inArray(schema.submissions.weekId, fixture.weekIds)),
    () => fixture.weekIds.length && db.delete(schema.enrollments).where(inArray(schema.enrollments.weekId, fixture.weekIds)),
  ];
  for (const userId of fixture.userIds) {
    steps.push(async () => {
      const events = await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.userId, userId));
      if (events.length) await db.delete(schema.deliveries).where(inArray(schema.deliveries.eventId, events.map((row) => row.id)));
      await db.delete(schema.events).where(eq(schema.events.userId, userId));
      await db.delete(schema.pointLedger).where(eq(schema.pointLedger.userId, userId));
      await db.delete(schema.pointAccounts).where(eq(schema.pointAccounts.userId, userId));
    });
  }
  // Weeks and projects last: ledger rows and rankings above point at them.
  steps.push(
    () => fixture.projectIds.length && db.delete(schema.projects).where(inArray(schema.projects.id, fixture.projectIds)),
    () => fixture.weekIds.length && db.delete(schema.weekRules).where(inArray(schema.weekRules.weekId, fixture.weekIds)),
    () => fixture.weekIds.length && db.delete(schema.weeks).where(inArray(schema.weeks.id, fixture.weekIds)),
    () => fixture.divisionIds.length && db.delete(schema.divisions).where(inArray(schema.divisions.id, fixture.divisionIds)),
  );
  steps.push(() => fixture.userIds.length && db.delete(schema.users).where(inArray(schema.users.id, fixture.userIds)));
  for (const step of steps) {
    try { await step(); } catch (error) { console.error(`[cleanup] ${STAMP}:`, error.cause?.message ?? error.message); }
  }
});

test("users: suspend and restore, with a reason, audited under the panel's subject", async () => {
  const { POST } = await route("admin/users/[id]/status");
  const target = await user("suspend");
  const path = `/api/internal/admin/users/${target.id}/status`;

  const suspended = await call(POST, path, { body: { status: "SUSPENDED", reason: "contract test" }, params: { id: target.id } });
  assert.equal(suspended.status, 200);
  assert.deepEqual(suspended.json, { data: { done: { userId: target.id, status: "SUSPENDED" } } });
  assert.equal((await db.select().from(schema.users).where(eq(schema.users.id, target.id)))[0].status, "SUSPENDED");

  const restored = await call(POST, path, { body: { status: "ACTIVE", reason: "contract test restore" }, params: { id: target.id } });
  assert.equal(restored.json.data.done.status, "ACTIVE");
  const audit = await auditFor(target.id, "USER_STATUS_SET");
  assert.deepEqual(audit.map((row) => [row.actorSubject, row.metadata.previousStatus, row.metadata.status]).sort(),
    [[SUBJECT, "ACTIVE", "SUSPENDED"], [SUBJECT, "SUSPENDED", "ACTIVE"]].sort());

  assert.equal((await call(POST, path, { body: { status: "SUSPENDED" }, params: { id: target.id } })).status, 400, "a reason is required");
  assert.equal((await call(POST, "/x", { body: { status: "SUSPENDED", reason: "r" }, params: { id: "not-a-uuid" } })).status, 400);
  assert.equal((await call(POST, path, { body: { status: "SUSPENDED", reason: "r" }, params: { id: target.id }, token: "x".repeat(64) })).status, 403);
});

test("reward stock and catalogue: four actions, each validated and audited", async () => {
  const { GET, POST } = await route("rewards/inventory");
  const [reward] = await db.insert(schema.catalog).values({
    slug: `${STAMP}-reward`, title: `${STAMP} Reward`, pointsCost: 100, rewardType: "DIGITAL", inventoryMode: "LIMITED", isActive: true,
  }).returning();
  fixture.rewardIds.push(reward.id);

  const off = await call(POST, "/api/internal/rewards/inventory", { body: { action: "catalog", rewardId: reward.id, isActive: false, reason: "pause" } });
  assert.deepEqual(off.json, { data: { done: { id: reward.id } } });
  assert.equal((await auditFor(reward.id, "REWARD_CATALOG_SET"))[0].metadata.previousActive, true);

  assert.equal((await call(POST, "/", { body: { action: "delivery", rewardId: reward.id, deliveryUrl: "http://insecure.example", reason: "r" } })).status, 400);
  const link = await call(POST, "/", { body: { action: "delivery", rewardId: reward.id, deliveryUrl: "https://example.com/kit", reason: "set link" } });
  assert.equal(link.status, 200);
  assert.equal((await auditFor(reward.id, "REWARD_DELIVERY_URL_SET"))[0].actorSubject, SUBJECT);

  const period = await call(POST, "/", { body: { action: "period", rewardId: reward.id, periodStart: "2030-01-01T00:00:00.000Z", periodEnd: "2030-02-01T00:00:00.000Z", quantityTotal: 5, reason: "stock" } });
  assert.equal(period.status, 200);
  const periodId = period.json.data.done.id;
  const overlap = await call(POST, "/", { body: { action: "period", rewardId: reward.id, periodStart: "2030-01-15T00:00:00.000Z", periodEnd: "2030-03-01T00:00:00.000Z", quantityTotal: 1, reason: "r" } });
  assert.equal(overlap.status, 400);
  assert.equal(overlap.json.error.code, "VALIDATION_ERROR");

  await db.update(schema.inventoryPeriods).set({ quantityReserved: 2, quantityFulfilled: 1 }).where(eq(schema.inventoryPeriods.id, periodId));
  assert.equal((await call(POST, "/", { body: { action: "quantity", periodId, quantityTotal: 2, reason: "r" } })).status, 400, "below reserved + fulfilled");
  assert.equal((await call(POST, "/", { body: { action: "quantity", periodId, quantityTotal: 3, reason: "exactly enough" } })).status, 200);
  assert.equal((await auditFor(periodId, "REWARD_INVENTORY_SET"))[0].metadata.quantityTotal, 3);
  assert.equal((await call(POST, "/", { body: { action: "quantity", periodId, quantityTotal: 3 } })).status, 400, "a reason is required");

  const listed = await call(GET, `/api/internal/rewards/inventory?q=${STAMP}`, { method: "GET" });
  const row = listed.json.data.rewards.find((entry) => entry.id === reward.id);
  assert.equal(row.isActive, false);
  assert.equal(row.deliveryUrl, "https://example.com/kit");
  assert.equal(listed.json.data.periods.find((entry) => entry.id === periodId).quantityTotal, 3);
});

test("orders: points refund, cancel and manual fulfil follow the existing rules and repeat safely", async () => {
  const { POST } = await route("store/orders/[id]/[action]");
  const buyer = await user("buyer");
  const [product] = await db.insert(schema.products).values({
    slug: `${STAMP}-product`, title: `${STAMP} Product`, productKind: "DOWNLOAD", status: "DRAFT", pointsCost: 50, priceIdrMinor: 10000,
  }).returning();
  fixture.productIds.push(product.id);
  const order = async (values) => {
    const [row] = await db.insert(schema.orders).values({ userId: buyer.id, productId: product.id, productTitle: product.title, idempotencyKey: `${STAMP}-${randomUUID()}`, ...values }).returning();
    fixture.orderIds.push(row.id);
    return row;
  };
  const act = (row, action, reason = "contract test") => call(POST, `/api/internal/store/orders/${row.id}/${action}`, { body: { reason }, params: { id: row.id, action } });

  // Points refund: only a FULFILLED points order; the second call changes nothing.
  const points = await order({ paymentMethod: "POINTS", status: "FULFILLED", pointsSpent: 50, paidAt: new Date(), fulfilledAt: new Date() });
  await db.insert(schema.entitlements).values({ userId: buyer.id, productId: product.id, orderId: points.id });
  const refunded = await act(points, "refund", "buyer asked");
  assert.deepEqual(refunded.json, { data: { refunded: true } });
  assert.equal((await db.select().from(schema.orders).where(eq(schema.orders.id, points.id)))[0].status, "REFUNDED");
  assert.ok((await db.select().from(schema.entitlements).where(eq(schema.entitlements.orderId, points.id)))[0].revokedAt, "the access is withdrawn with the points");
  assert.equal((await db.select().from(schema.pointLedger).where(eq(schema.pointLedger.idempotencyKey, `store-order:${points.id}:refund`)))[0].amount, 50);
  assert.equal((await act(points, "refund")).status, 200);
  assert.equal((await auditFor(points.id, "STORE_ORDER_REFUNDED")).length, 1, "a repeated refund is a no-op");

  // A rupiah order is never refunded here — money moves only through Midtrans.
  const rupiah = await order({ paymentMethod: "IDR", status: "FULFILLED", amountIdrMinor: 10000, providerOrderId: `${STAMP}-idr-1`, paidAt: new Date(), fulfilledAt: new Date() });
  const refusal = await act(rupiah, "refund");
  assert.equal(refusal.status, 400);
  assert.match(refusal.json.error.message, /Midtrans/);
  assert.equal((await db.select().from(schema.orders).where(eq(schema.orders.id, rupiah.id)))[0].status, "FULFILLED");

  // Cancel: PENDING only, then a no-op.
  const pending = await order({ paymentMethod: "IDR", status: "PENDING", amountIdrMinor: 10000, providerOrderId: `${STAMP}-idr-2` });
  assert.deepEqual((await act(pending, "cancel")).json, { data: { closed: true } });
  assert.deepEqual((await act(pending, "cancel")).json, { data: { closed: false } });
  assert.equal((await auditFor(pending.id, "STORE_ORDER_FAILED")).length, 1);

  // Manual fulfil: grants access once; the reason is kept on the order.
  await db.delete(schema.entitlements).where(eq(schema.entitlements.orderId, points.id));
  const unpaid = await order({ paymentMethod: "IDR", status: "PENDING", amountIdrMinor: 10000, providerOrderId: `${STAMP}-idr-3` });
  const fulfilled = await act(unpaid, "fulfill", "seen as settled in Midtrans");
  assert.equal(fulfilled.json.data.done.fulfilled, true);
  const [settled] = await db.select().from(schema.orders).where(eq(schema.orders.id, unpaid.id));
  assert.equal(settled.status, "FULFILLED");
  assert.equal(settled.providerStatus, "manual:seen as settled in Midtrans");
  assert.equal((await db.select().from(schema.entitlements).where(eq(schema.entitlements.orderId, unpaid.id))).length, 1);
  assert.equal((await act(unpaid, "fulfill")).json.data.done.fulfilled, false);
  assert.equal((await auditFor(unpaid.id, "STORE_ORDER_FULFILLED")).length, 1);

  assert.equal((await call(POST, "/", { body: {}, params: { id: unpaid.id, action: "fulfill" } })).status, 400, "a reason is required");
  assert.equal((await act(unpaid, "chargeback")).status, 404);
});

test("flags: a reason and the previous state are kept in the audit", async () => {
  const { POST } = await route("admin/flags");
  const closed = await call(POST, "/api/internal/admin/flags", { body: { key: "arena-publish", closed: true, message: "Maintenance", reason: "contract test" } });
  assert.deepEqual(closed.json, { data: { done: { key: "arena-publish", closed: true } } });
  const reopened = await call(POST, "/api/internal/admin/flags", { body: { key: "arena-publish", closed: false, reason: "contract test done" } });
  assert.equal(reopened.status, 200);
  const rows = (await auditFor("arena-publish", "FEATURE_FLAG_SET")).filter((row) => row.actorSubject === SUBJECT && row.metadata.reason?.startsWith("contract test"));
  const last = rows.sort((a, b) => b.createdAt - a.createdAt)[0];
  assert.deepEqual([last.metadata.closed, last.metadata.previousClosed, last.metadata.reason], [false, true, "contract test done"]);
  assert.equal((await call(POST, "/", { body: { key: "unknown", closed: true } })).status, 400);
});

test("rubric authoring freezes once; a second rubric is refused", async () => {
  const { POST, PATCH } = await route("admin/divisions");
  const created = await call(POST, "/api/internal/admin/divisions", { body: { slug: `${STAMP}-div`, name: `${STAMP} Division`, isActive: false } });
  const divisionId = created.json.data.division.id;
  fixture.divisionIds.push(divisionId);
  const rubric = [{ name: "Analisis", weight: 60, maxScore: 100 }, { name: "Komunikasi", weight: 40, maxScore: 100 }];
  const frozen = await call(PATCH, "/api/internal/admin/divisions", { method: "PATCH", body: { divisionId, baseRubric: rubric } });
  assert.equal(frozen.status, 200);
  assert.equal((await auditFor(divisionId, "generation.rubric-frozen"))[0].actorSubject, SUBJECT);
  const again = await call(PATCH, "/", { method: "PATCH", body: { divisionId, baseRubric: rubric } });
  assert.equal(again.status, 400);
  assert.match(again.json.error.message, /already frozen/);
  const duplicate = await call(PATCH, "/", { method: "PATCH", body: { divisionId, baseRubric: [{ name: "A", weight: 1, maxScore: 1 }, { name: "a", weight: 1, maxScore: 1 }] } });
  assert.equal(duplicate.status, 400);
});

test("projects: regenerate only flags the project, and cover stops short without a provider", async () => {
  const { POST } = await route("admin/projects/[id]/[action]");
  const [division] = await db.insert(schema.divisions).values({ slug: `${STAMP}-pdiv`, name: `${STAMP} PDiv`, isActive: false, sortOrder: 9999 }).returning();
  fixture.divisionIds.push(division.id);
  const [week] = await db.insert(schema.weeks).values({
    weekCode: `${STAMP}-W`.slice(0, 40), title: `${STAMP} week`, status: "DRAFT",
    opensAt: new Date("2031-01-05T02:00:00.000Z"), submissionDeadlineAt: new Date("2031-01-11T16:59:00.000Z"), timezone: "Asia/Jakarta",
  }).returning();
  fixture.weekIds.push(week.id);
  await db.insert(schema.weekRules).values({ weekId: week.id, maxProjectsPerUser: 1, maxReviewAttempts: 3, allowLateSubmission: false });
  const [project] = await db.insert(schema.projects).values({
    weekId: week.id, divisionId: division.id, slug: `${STAMP}-project`, title: `${STAMP} project`,
    shortDescription: "fixture", status: "PREVIEWED", estimatedMinutes: 120, difficulty: "STANDARD",
  }).returning();
  fixture.projectIds.push(project.id);

  const regenerate = await call(POST, "/", { body: { reason: "weak brief" }, params: { id: project.id, action: "regenerate" } });
  assert.equal(regenerate.status, 200);
  assert.equal(regenerate.json.data.action, "regenerate");
  const [after] = await db.select().from(schema.projects).where(eq(schema.projects.id, project.id));
  assert.deepEqual([after.status, after.previewStatus], ["REJECTED", "REGENERATE_REQUESTED"]);

  const cover = await call(POST, "/", { body: { reason: "refresh" }, params: { id: project.id, action: "cover" } });
  assert.equal(cover.status, 200);
  assert.match(cover.json.data.skipped, /not configured/, "no image model is called in the sandbox");
  assert.equal((await call(POST, "/", { body: {}, params: { id: project.id, action: "veto" } })).status, 400, "a reason is required");
});

test("enrolment void revokes the awarded points once", async () => {
  const { POST } = await route("enrollments/[id]/void");
  const participant = await user("void");
  const [division] = await db.insert(schema.divisions).values({ slug: `${STAMP}-vdiv`, name: `${STAMP} VDiv`, isActive: false, sortOrder: 9999 }).returning();
  fixture.divisionIds.push(division.id);
  const now = new Date();
  const [week] = await db.insert(schema.weeks).values({
    weekCode: `${STAMP}-V`.slice(0, 40), title: `${STAMP} void week`, status: "FINALIZED",
    opensAt: new Date(now.getTime() - 8 * 86_400_000), submissionDeadlineAt: new Date(now.getTime() - 86_400_000), finalizedAt: now, timezone: "Asia/Jakarta",
  }).returning();
  fixture.weekIds.push(week.id);
  await db.insert(schema.weekRules).values({ weekId: week.id, maxProjectsPerUser: 1, maxReviewAttempts: 3, allowLateSubmission: false });
  const [project] = await db.insert(schema.projects).values({
    weekId: week.id, divisionId: division.id, slug: `${STAMP}-vproject`, title: `${STAMP} vproject`,
    shortDescription: "fixture", status: "PUBLISHED", publishedAt: now, estimatedMinutes: 120, difficulty: "STANDARD",
  }).returning();
  fixture.projectIds.push(project.id);
  const [enrollment] = await db.insert(schema.enrollments).values({ userId: participant.id, weekId: week.id, projectId: project.id }).returning();
  const [submission] = await db.insert(schema.submissions).values({
    enrollmentId: enrollment.id, userId: participant.id, weekId: week.id, projectId: project.id, status: "FINALIZED",
  }).returning();
  const [version] = await db.insert(schema.submissionVersions).values({
    submissionId: submission.id, versionNumber: 1, submittedAt: now, accessStatus: "ACCESSIBLE", reviewAttemptNumber: 1, reviewStatus: "COMPLETED",
  }).returning();
  fixture.versionIds.push(version.id);
  const [review] = await db.insert(schema.reviews).values({
    submissionVersionId: version.id, runNumber: 1, status: "COMPLETED_HIDDEN", aiScore: "80.00", finalScore: "80.00", summary: "fixture", reviewedAt: now,
  }).returning();
  fixture.reviewIds.push(review.id);
  await db.insert(schema.weeklyRankings).values({
    weekId: week.id, userId: participant.id, projectId: project.id, submissionVersionId: version.id, reviewId: review.id,
    finalScore: "80.00", finalSubmittedAt: now, rank: 1, pointsAwarded: 300,
  });
  await db.insert(schema.pointLedger).values({ userId: participant.id, amount: 300, entryType: "WEEKLY_RANK", weekId: week.id, idempotencyKey: `${STAMP}-award` });
  await db.insert(schema.pointAccounts).values({ userId: participant.id, balance: 300, lifetimeEarned: 300 });

  const path = `/api/internal/enrollments/${enrollment.id}/void`;
  const voided = await call(POST, path, { body: { reason: "plagiarism confirmed" }, params: { id: enrollment.id } });
  assert.deepEqual(voided.json, { data: { done: { enrollmentId: enrollment.id, pointsRevoked: 300 } } });
  assert.equal((await db.select().from(schema.pointAccounts).where(eq(schema.pointAccounts.userId, participant.id)))[0].balance, 0);
  assert.equal((await db.select().from(schema.enrollments).where(eq(schema.enrollments.id, enrollment.id)))[0].status, "VOIDED");
  const repeat = await call(POST, path, { body: { reason: "again" }, params: { id: enrollment.id } });
  assert.equal(repeat.json.data.done.pointsRevoked, 0, "the points are taken back once");
  assert.equal((await db.select().from(schema.pointLedger).where(eq(schema.pointLedger.idempotencyKey, `void:${enrollment.id}`))).length, 1);
  assert.equal((await auditFor(enrollment.id, "FRAUD_VOID"))[0].actorSubject, SUBJECT);
  assert.equal((await call(POST, path, { body: {}, params: { id: enrollment.id } })).status, 400, "a reason is required");
});

test("email outbox needs the notifications scope; cancel and requeue never send", async () => {
  const { GET } = await route("admin/email-outbox");
  const { POST } = await route("admin/email-outbox/[action]");
  const recipient = await user("mail");
  const [event] = await db.insert(schema.events).values({ type: "RESULT_READY", userId: recipient.id, title: "t", body: "b" }).returning();
  const [delivery] = await db.insert(schema.deliveries).values({ eventId: event.id, channel: "EMAIL", status: "FAILED", errorCode: "PROVIDER_REJECTED", attemptCount: 3 }).returning();

  // The panel's scope list today leaves this out on purpose.
  assert.equal((await call(GET, "/api/internal/admin/email-outbox", { method: "GET" })).status, 403);
  process.env.CENTRAL_ADMIN_SCOPES = `${PANEL_SCOPES},notifications`;
  try {
    const listed = await call(GET, "/api/internal/admin/email-outbox?limit=100", { method: "GET" });
    assert.equal(listed.status, 200);
    assert.ok("summary" in listed.json.data && Array.isArray(listed.json.data.rows));

    const cancel = await call(POST, "/", { body: { deliveryId: delivery.id, reason: "wrong address" }, params: { action: "cancel" } });
    assert.equal(cancel.status, 200);
    let [row] = await db.select().from(schema.deliveries).where(eq(schema.deliveries.id, delivery.id));
    assert.deepEqual([row.status, row.errorCode, row.sentAt], ["SKIPPED", "ADMIN_CANCELLED", null]);

    const requeue = await call(POST, "/", { body: { deliveryId: delivery.id, reason: "address fixed" }, params: { action: "requeue" } });
    assert.deepEqual(requeue.json, { data: { done: { id: delivery.id, status: "PENDING" } } });
    [row] = await db.select().from(schema.deliveries).where(eq(schema.deliveries.id, delivery.id));
    assert.deepEqual([row.status, row.attemptCount, row.sentAt], ["PENDING", 0, null], "requeue hands it back to the worker; nothing is sent here");
    assert.equal((await auditFor(delivery.id, "EMAIL_DELIVERY_REQUEUED"))[0].metadata.reason, "address fixed");

    await call(POST, "/", { body: { deliveryId: delivery.id, reason: "leave the fixture unsent" }, params: { action: "cancel" } });
    assert.equal((await call(POST, "/", { body: { deliveryId: delivery.id }, params: { action: "cancel" } })).status, 400, "a reason is required");
    assert.equal((await call(POST, "/", { body: { deliveryId: delivery.id, reason: "r" }, params: { action: "send" } })).status, 404);
  } finally {
    process.env.CENTRAL_ADMIN_SCOPES = PANEL_SCOPES;
  }
});

test("product file upload: a signed PUT, then a FILE product that points at it", async () => {
  const { POST: uploadUrl } = await route("store/upload-url");
  const { POST: createProduct } = await route("store/products");
  const minted = await call(uploadUrl, "/api/internal/store/upload-url", { body: { mimeType: "application/pdf" } });
  assert.equal(minted.status, 200);
  const { uploadUrl: url, storageKey } = minted.json.data.upload;
  assert.ok(url.startsWith("http://127.0.0.1:"), "the sandbox signs against its local bucket");

  const put = await fetch(url, { method: "PUT", body: Buffer.from("%PDF-1.4 contract test"), headers: { "content-type": "application/pdf" } });
  assert.equal(put.status, 200);

  const product = { slug: `${STAMP}-file`, title: `${STAMP} File`, productKind: "DOWNLOAD", status: "DRAFT", deliveryKind: "FILE", deliveryObjectKey: storageKey, deliveryFilename: "guide.pdf" };
  const created = await call(createProduct, "/api/internal/store/products", { body: product });
  assert.equal(created.status, 201);
  fixture.productIds.push(created.json.data.product.id);
  assert.equal(created.json.data.product.deliveryObjectKey, storageKey);

  const missing = await call(createProduct, "/", { body: { ...product, slug: `${STAMP}-file-2`, deliveryObjectKey: `${storageKey}-missing` } });
  assert.equal(missing.status, 400);
  assert.equal(missing.json.error.details.field, "deliveryObjectKey");
  const noLink = await call(createProduct, "/", { body: { ...product, slug: `${STAMP}-link`, deliveryKind: "LINK", deliveryObjectKey: null } });
  assert.deepEqual([noLink.status, noLink.json.error.details.field], [400, "deliveryUrl"]);
  const taken = await call(createProduct, "/", { body: product });
  assert.deepEqual([taken.status, taken.json.error.code, taken.json.error.details.field], [409, "PRODUCT_SLUG_TAKEN", "slug"]);
  assert.equal((await call(uploadUrl, "/", { body: { mimeType: "not a type" } })).json.error.details.field, "mimeType");
});
