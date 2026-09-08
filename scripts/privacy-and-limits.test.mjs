/**
 * Consent, deletion and the CV spend cap, against a real database.
 *
 * Three claims that only a real database can settle: that the Showcase query
 * itself excludes a non-consenting participant (rather than a filter somewhere
 * downstream that a future caller could bypass), that account deletion erases
 * what it says it erases while leaving shared history intact, and that the CV
 * limiter holds under actual concurrency rather than in a mock that never races.
 *
 * Needs the local sandbox. Excluded from `npm run test:offline` automatically
 * because it reads DATABASE_URL.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { localEnvironment } from "./local-env.mjs";

const sandbox = localEnvironment();
for (const [key, value] of Object.entries(sandbox)) process.env[key] = value;
assert.equal(process.env.ARENA_LOCAL_SANDBOX, "1");
assert.match(process.env.DATABASE_URL, /127\.0\.0\.1|localhost/);

const { getDb } = await import("../src/server/db/client.ts");
const schema = await import("../src/server/db/schema/index.ts");
const { and, eq, inArray } = await import("drizzle-orm");
const { deleteArenaAccount, getPrivacyState, setShowcaseConsent } = await import("../src/server/arena/privacy-service.ts");
const { getLatestSpotlightWithConsent, listSpotlightHistory } = await import("../src/server/finalization/showcase-service.ts");
const { checkRateLimit, pruneRateLimitCounters, rateLimitConfigForTests } = await import("../src/server/cv/rate-limit.ts");

const db = getDb();
const STAMP = `priv-it-${Date.now()}-${randomUUID().slice(0, 8)}`;
const fixture = { userIds: [], weekId: null, divisionId: null, projectIds: [], reviewIds: [], versionIds: [] };

async function seedFinalizedWeek() {
  const now = new Date();
  const [division] = await db.insert(schema.divisions).values({
    slug: `${STAMP}-div`, name: `${STAMP} Division`, isActive: true, sortOrder: 9999,
  }).returning();
  fixture.divisionId = division.id;
  const [week] = await db.insert(schema.weeks).values({
    weekCode: STAMP, title: `${STAMP} Week`, status: "FINALIZED",
    opensAt: new Date(now.getTime() - 7 * 86_400_000),
    submissionDeadlineAt: new Date(now.getTime() - 86_400_000),
    finalizedAt: now, timezone: "Asia/Jakarta",
  }).returning();
  fixture.weekId = week.id;
  await db.insert(schema.weekRules).values({ weekId: week.id, maxProjectsPerUser: 1, maxReviewAttempts: 3, allowLateSubmission: false });

  const participants = [];
  for (const [index, label] of ["consenting", "private"].entries()) {
    const [user] = await db.insert(schema.users).values({
      authSubject: `${STAMP}-${label}`, displayNameCache: `${STAMP} ${label}`, emailCache: `${label}@example.test`,
    }).returning();
    fixture.userIds.push(user.id);
    const [project] = await db.insert(schema.projects).values({
      weekId: week.id, divisionId: division.id, slug: `${STAMP}-${label}`, title: `${STAMP} ${label} project`,
      shortDescription: "fixture", status: "PUBLISHED", publishedAt: now, estimatedMinutes: 120, difficulty: "STANDARD",
    }).returning();
    fixture.projectIds.push(project.id);
    const [enrollment] = await db.insert(schema.enrollments).values({
      userId: user.id, weekId: week.id, projectId: project.id,
    }).returning();
    const [submission] = await db.insert(schema.submissions).values({
      enrollmentId: enrollment.id, userId: user.id, weekId: week.id, projectId: project.id, status: "FINALIZED",
    }).returning();
    const [version] = await db.insert(schema.submissionVersions).values({
      submissionId: submission.id, versionNumber: 1, submittedAt: now,
      accessStatus: "ACCESSIBLE", reviewAttemptNumber: 1, reviewStatus: "COMPLETED",
    }).returning();
    fixture.versionIds.push(version.id);
    const [review] = await db.insert(schema.reviews).values({
      submissionVersionId: version.id, runNumber: 1, status: "COMPLETED_HIDDEN",
      aiScore: "80.00", finalScore: "80.00", summary: "fixture review", reviewedAt: now,
    }).returning();
    fixture.reviewIds.push(review.id);
    await db.insert(schema.weeklyRankings).values({
      weekId: week.id, userId: user.id, projectId: project.id, submissionVersionId: version.id,
      reviewId: review.id, finalScore: "80.00", finalSubmittedAt: now, rank: index + 1, pointsAwarded: index === 0 ? 300 : 200,
    });
    participants.push({ user, project, review, enrollment, submission });
  }
  return participants;
}

let consenting;
let priv;

before(async () => {
  const [first, second] = await seedFinalizedWeek();
  consenting = first;
  priv = second;
});

after(async () => {
  if (fixture.weekId) {
    await db.delete(schema.weeklyRankings).where(eq(schema.weeklyRankings.weekId, fixture.weekId));
    await db.delete(schema.skillEvidence).where(eq(schema.skillEvidence.weekId, fixture.weekId));
    if (fixture.reviewIds.length) {
      await db.delete(schema.reviewScores).where(inArray(schema.reviewScores.reviewId, fixture.reviewIds));
      await db.delete(schema.reviews).where(inArray(schema.reviews.id, fixture.reviewIds));
    }
    if (fixture.versionIds.length) {
      await db.delete(schema.submissionVersionItems).where(inArray(schema.submissionVersionItems.submissionVersionId, fixture.versionIds));
      await db.delete(schema.submissionVersions).where(inArray(schema.submissionVersions.id, fixture.versionIds));
    }
    await db.delete(schema.submissions).where(eq(schema.submissions.weekId, fixture.weekId));
    const enrollmentRows = await db.select({ id: schema.enrollments.id }).from(schema.enrollments).where(eq(schema.enrollments.weekId, fixture.weekId));
    if (enrollmentRows.length) {
      await db.delete(schema.workspaceProgress).where(inArray(schema.workspaceProgress.enrollmentId, enrollmentRows.map((row) => row.id)));
    }
    await db.delete(schema.enrollments).where(eq(schema.enrollments.weekId, fixture.weekId));
  }
  for (const userId of fixture.userIds) {
    await db.delete(schema.cvScans).where(eq(schema.cvScans.userId, userId));
    await db.delete(schema.pointLedger).where(eq(schema.pointLedger.userId, userId));
    await db.delete(schema.pointAccounts).where(eq(schema.pointAccounts.userId, userId));
    const eventRows = await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.userId, userId));
    if (eventRows.length) await db.delete(schema.deliveries).where(inArray(schema.deliveries.eventId, eventRows.map((row) => row.id)));
    await db.delete(schema.events).where(eq(schema.events.userId, userId));
  }
  if (fixture.projectIds.length) await db.delete(schema.projects).where(inArray(schema.projects.id, fixture.projectIds));
  if (fixture.weekId) {
    await db.delete(schema.weekRules).where(eq(schema.weekRules.weekId, fixture.weekId));
    await db.delete(schema.weeks).where(eq(schema.weeks.id, fixture.weekId));
  }
  if (fixture.divisionId) await db.delete(schema.divisions).where(eq(schema.divisions.id, fixture.divisionId));
  if (fixture.userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, fixture.userIds));
  await db.delete(schema.rateLimitCounters).where(eq(schema.rateLimitCounters.bucket, rateLimitConfigForTests.BUCKET));
});

test("a finalized top rank is NOT on the showcase until the participant says yes", async () => {
  const before = await getLatestSpotlightWithConsent(db);
  assert.equal(before.entries.some((entry) => entry.weekCode === STAMP), false, "private by default");

  await setShowcaseConsent({ userId: consenting.user.id, consent: true, source: "test" });
  const after = await getLatestSpotlightWithConsent(db);
  const mine = after.entries.filter((entry) => entry.weekCode === STAMP);
  assert.equal(mine.length, 1, "only the consenting participant appears");
  assert.equal(mine[0].rank, 1);
  assert.ok(mine[0].participantName.includes("consenting"));
  // The other ranked participant is counted as withheld rather than vanishing,
  // so an operator can tell "nobody opted in" from "nobody finished".
  assert.ok(after.withheld >= 1);
});

test("withdrawing consent removes the entry on the next read", async () => {
  await setShowcaseConsent({ userId: consenting.user.id, consent: true, source: "test" });
  assert.ok((await getLatestSpotlightWithConsent(db)).entries.some((entry) => entry.weekCode === STAMP));

  const withdrawn = await setShowcaseConsent({ userId: consenting.user.id, consent: false });
  assert.equal(withdrawn.consented, false);
  assert.equal((await getLatestSpotlightWithConsent(db)).entries.some((entry) => entry.weekCode === STAMP), false);
  assert.equal((await listSpotlightHistory(20, db)).some((row) => row.weekCode === STAMP), false,
    "the history list is gated too, not only the featured entry");

  const state = await getPrivacyState(consenting.user.id, db);
  assert.equal(state.showcaseConsent, false);
  assert.equal(state.showcaseConsentAt, null);
});

test("consent is recorded as an auditable act, not just a flag", async () => {
  await setShowcaseConsent({ userId: consenting.user.id, consent: true, source: "test" });
  const granted = await db.select().from(schema.logs)
    .where(and(eq(schema.logs.action, "SHOWCASE_CONSENT_GRANTED"), eq(schema.logs.entityId, consenting.user.id)));
  assert.ok(granted.length >= 1);
  const state = await getPrivacyState(consenting.user.id, db);
  assert.ok(state.showcaseConsentAt instanceof Date, "consent carries the moment it was given");
  await setShowcaseConsent({ userId: consenting.user.id, consent: false });
});

test("deleting an account erases the person and keeps the shared arithmetic", async () => {
  const target = priv.user;
  await db.insert(schema.cvScans).values({
    userId: target.id,
    result: { score: 70, statusLabel: "OK", fileName: "cv.pdf", analyzedAt: new Date().toISOString(), evidence: [] },
  });
  await db.insert(schema.events).values({
    type: "RESULT_READY", userId: target.id, weekId: fixture.weekId,
    title: "hasil", body: "isi", dedupeKey: `${STAMP}-notice`,
  });
  const [enrollment] = await db.select().from(schema.enrollments).where(eq(schema.enrollments.userId, target.id));
  await db.insert(schema.workspaceProgress).values({
    enrollmentId: enrollment.id, currentStep: "PLAN", planText: "rencana pribadi", notes: "catatan pribadi",
  });
  await setShowcaseConsent({ userId: target.id, consent: true, source: "test" });

  const result = await deleteArenaAccount({ userId: target.id, requestedBy: "USER", actorSubject: target.authSubject, reason: "test" });
  assert.ok(result.anonymizedAt instanceof Date);
  assert.equal(result.erased.cvScans, 1);
  assert.equal(result.erased.notifications, 1);
  assert.equal(result.erased.workspaces, 1);

  const [after] = await db.select().from(schema.users).where(eq(schema.users.id, target.id));
  assert.equal(after.emailCache, null);
  assert.equal(after.displayNameCache, null);
  assert.equal(after.status, "SUSPENDED", "the credential must not sign back in and re-attach a name");
  assert.equal(after.showcaseConsentAt, null, "deletion revokes consent");
  assert.notEqual(after.authSubject, target.authSubject);
  assert.match(after.authSubject, /^deleted:/);

  assert.equal((await db.select().from(schema.cvScans).where(eq(schema.cvScans.userId, target.id))).length, 0);
  assert.equal((await db.select().from(schema.events).where(eq(schema.events.userId, target.id))).length, 0);
  const [workspace] = await db.select().from(schema.workspaceProgress).where(eq(schema.workspaceProgress.enrollmentId, enrollment.id));
  assert.equal(workspace.planText, null);
  assert.equal(workspace.notes, null);

  // The week's leaderboard must not change shape because someone left.
  const rankings = await db.select().from(schema.weeklyRankings).where(eq(schema.weeklyRankings.weekId, fixture.weekId));
  assert.equal(rankings.length, 2, "a finalized week's ranking survives a deletion");

  // And the audit row explaining the deletion must not be where the identity lives on.
  const [audit] = await db.select().from(schema.logs)
    .where(and(eq(schema.logs.action, "ACCOUNT_DELETED"), eq(schema.logs.entityId, target.id)));
  assert.ok(audit);
  assert.equal(JSON.stringify(audit.metadata).includes("@example.test"), false);
});

test("deleting twice is a no-op, not an error", async () => {
  const target = priv.user;
  const again = await deleteArenaAccount({ userId: target.id, requestedBy: "ADMIN", actorSubject: "admin", reason: "again" });
  assert.ok(again.anonymizedAt instanceof Date);
  assert.equal(again.erased.cvScans, 0);
});

// -------------------------------------------------------------- CV limiter

test("the CV limiter holds under real concurrency, not just in a mock", async () => {
  const key = `${STAMP}-burst`;
  const now = Date.now();
  // Twenty simultaneous requests from one caller against a limit of five: the
  // upsert is the arbiter, so two instances cannot both read four and both allow.
  const decisions = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit(key, now, db)));
  const allowed = decisions.filter((decision) => decision.allowed);
  assert.equal(allowed.length, rateLimitConfigForTests.MAX_PER_WINDOW,
    `expected exactly ${rateLimitConfigForTests.MAX_PER_WINDOW} allowed, saw ${allowed.length}`);
  assert.ok(decisions.every((decision) => !decision.degraded), "the shared counter must have answered every call");
  const refused = decisions.find((decision) => !decision.allowed);
  assert.equal(refused.scope, "caller");
  assert.ok(refused.retryAfterSeconds > 0);
});

test("the endpoint has a total spend cap, not only a per-caller one", async () => {
  const now = Date.now();
  const cap = 8;
  const env = { ...process.env, CV_SCAN_HOURLY_CAP: String(cap) };
  const results = [];
  // Each caller stays inside its own allowance, so only a global ceiling can
  // stop this — which is the whole point: a per-IP limit is not a spend cap.
  for (let caller = 0; caller < 6; caller += 1) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      results.push(await checkRateLimit(`${STAMP}-global-${caller}`, now, db, env));
    }
  }
  const allowed = results.filter((decision) => decision.allowed);
  assert.ok(allowed.length <= cap, `global cap must bound the total, saw ${allowed.length} allowed against a cap of ${cap}`);
  const globalRefusal = results.find((decision) => decision.scope === "global");
  assert.ok(globalRefusal, "a refusal caused by the total budget must say so");
});

test("spent windows are pruned rather than accumulating forever", async () => {
  const stale = new Date(Date.now() - 4 * rateLimitConfigForTests.WINDOW_MS);
  await db.insert(schema.rateLimitCounters).values({
    bucket: rateLimitConfigForTests.BUCKET, subject: `${STAMP}-stale`, windowStart: stale, count: 3,
  });
  const pruned = await pruneRateLimitCounters(new Date(), db);
  assert.ok(pruned >= 1);
  const left = await db.select().from(schema.rateLimitCounters)
    .where(and(eq(schema.rateLimitCounters.bucket, rateLimitConfigForTests.BUCKET), eq(schema.rateLimitCounters.subject, `${STAMP}-stale`)));
  assert.equal(left.length, 0);
});
