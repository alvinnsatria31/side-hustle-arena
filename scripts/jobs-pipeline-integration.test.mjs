/**
 * The Jobs pipeline against a real database, with a fake provider.
 *
 * The unit suite proves each rule in isolation; this proves the rules hold once
 * Postgres, the lease, the unique constraints and the upsert are involved —
 * which is where "idempotent" and "concurrent" stop being adjectives and start
 * being claims that can be wrong.
 *
 * Needs the local sandbox (`node scripts/local-dev.mjs --setup-only`). Touches
 * no live database, no bucket, no provider: the adapter is injected and returns
 * pages from memory. Excluded from `npm run test:offline` automatically because
 * it reads DATABASE_URL.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { localEnvironment } from "./local-env.mjs";

const sandbox = localEnvironment();
for (const [key, value] of Object.entries(sandbox)) process.env[key] = value;
assert.equal(process.env.ARENA_LOCAL_SANDBOX, "1");
// Also the marker `scripts/run-offline-tests.mjs` looks for when deciding what
// it can run without a database — this suite needs a real one.
assert.match(process.env.DATABASE_URL, /127\.0\.0\.1|localhost/);

const { getDb } = await import("../src/server/db/client.ts");
const schema = await import("../src/server/db/schema/index.ts");
const { and, eq, inArray } = await import("drizzle-orm");
const {
  assertFeedTransportAllowed, getJobSourceStatus, leaseSource, resolveCredential,
  setJobSourceActive, syncDueJobSources, syncJobSource,
} = await import("../src/server/career/jobs/sync-service.ts");
const { getJobsOverview } = await import("../src/server/career/jobs-service.ts");
const { createExecutionBudget } = await import("../src/server/ops/execution-budget.ts");

const db = getDb();
const STAMP = `jobs-it-${Date.now()}-${randomUUID().slice(0, 8)}`;

const fieldMap = {
  externalId: "id", title: "role", company: "company.name", location: "city",
  workMode: "arrangement", employmentType: "contract", description: "summary",
  requiredSkills: "skills_required", applicationUrl: "apply", postedAt: "posted", expiresAt: "expires",
};

const record = (over = {}) => ({
  id: "fx-1", role: "Junior Data Analyst", company: { name: "Studio Contoh (fiktif)" }, city: "Jakarta",
  arrangement: "Hybrid", contract: "Full-time", summary: "Menyusun laporan margin per kanal.",
  skills_required: [], apply: "https://example.invalid/fx-1", posted: "2026-09-01T02:00:00Z",
  ...over,
});

/**
 * A provider that returns exactly what a test tells it to, one page at a time.
 * Records every request so pagination and cursor use can be asserted rather
 * than assumed.
 */
function fakeAdapter(pages) {
  const requests = [];
  return {
    requests,
    adapter: {
      name: "test-adapter",
      async fetchPage(request) {
        requests.push({ cursor: request.cursor ?? null, credential: request.credential ?? null });
        const index = Number(request.cursor ?? 0);
        const page = pages[index];
        if (!page) return { items: [], nextCursor: null };
        if (page.throw) throw page.throw;
        return { items: page.items, nextCursor: index + 1 < pages.length ? String(index + 1) : null };
      },
    },
  };
}

const fixture = { sourceIds: [], skillIds: [], userId: null, weekId: null, divisionId: null, projectId: null };

async function createSource(over = {}) {
  const [source] = await db.insert(schema.jobSources).values({
    slug: `${STAMP}-${over.slug ?? "src"}`,
    name: `${STAMP} source`,
    adapter: "test-adapter",
    config: { fieldMap, maxPages: 10, ...over.config },
    isActive: true,
    syncIntervalMinutes: 60,
    stalenessDays: 3,
    ...over.row,
  }).returning();
  fixture.sourceIds.push(source.id);
  return source;
}

before(async () => {
  const [sql] = await db.insert(schema.skills).values({ slug: `${STAMP}-sql`, name: `${STAMP} SQL` }).returning();
  const [excel] = await db.insert(schema.skills).values({ slug: `${STAMP}-excel`, name: `${STAMP} Excel` }).returning();
  fixture.skillIds.push(sql.id, excel.id);
  fixture.sqlSkill = sql;
  fixture.excelSkill = excel;
});

after(async () => {
  if (fixture.sourceIds.length) {
    // job_openings and job_sync_runs cascade from job_sources.
    await db.delete(schema.jobSources).where(inArray(schema.jobSources.id, fixture.sourceIds));
  }
  if (fixture.weekId) {
    await db.delete(schema.weeklyRankings).where(eq(schema.weeklyRankings.weekId, fixture.weekId));
    await db.delete(schema.skillEvidence).where(eq(schema.skillEvidence.weekId, fixture.weekId));
    await db.delete(schema.reviewScores).where(inArray(
      schema.reviewScores.reviewId,
      db.select({ id: schema.reviews.id }).from(schema.reviews).where(eq(schema.reviews.submissionVersionId, fixture.versionId ?? randomUUID())),
    )).catch(() => undefined);
    if (fixture.reviewId) await db.delete(schema.reviews).where(eq(schema.reviews.id, fixture.reviewId));
    if (fixture.versionId) await db.delete(schema.submissionVersions).where(eq(schema.submissionVersions.id, fixture.versionId));
    await db.delete(schema.submissions).where(eq(schema.submissions.weekId, fixture.weekId));
    await db.delete(schema.enrollments).where(eq(schema.enrollments.weekId, fixture.weekId));
    if (fixture.projectId) {
      await db.delete(schema.projectSkills).where(eq(schema.projectSkills.projectId, fixture.projectId));
      await db.delete(schema.projects).where(eq(schema.projects.id, fixture.projectId));
    }
    await db.delete(schema.weekRules).where(eq(schema.weekRules.weekId, fixture.weekId));
    await db.delete(schema.weeks).where(eq(schema.weeks.id, fixture.weekId));
  }
  if (fixture.userId) await db.delete(schema.users).where(eq(schema.users.id, fixture.userId));
  if (fixture.divisionId) await db.delete(schema.divisions).where(eq(schema.divisions.id, fixture.divisionId));
  await db.delete(schema.skillAliases).where(inArray(schema.skillAliases.skillId, fixture.skillIds));
  if (fixture.skillIds.length) await db.delete(schema.skills).where(inArray(schema.skills.id, fixture.skillIds));
});

const openingsOf = (sourceId) =>
  db.select().from(schema.jobOpenings).where(eq(schema.jobOpenings.sourceId, sourceId)).orderBy(schema.jobOpenings.externalId);

test("a first sync creates openings, and running it again changes nothing", async () => {
  const source = await createSource({ slug: "idempotent" });
  const { adapter, requests } = fakeAdapter([{ items: [record(), record({ id: "fx-2", role: "BI Intern" })] }]);

  const first = await syncJobSource({
    sourceId: source.id, triggeredBy: "test", adapters: { "test-adapter": adapter },
    idempotencyKey: `${STAMP}-run-1`,
  });
  assert.equal(first.status, "SUCCESS");
  assert.equal(first.totals.itemsCreated, 2);
  assert.equal(first.totals.itemsSeen, 2);

  const created = await openingsOf(source.id);
  assert.equal(created.length, 2);
  assert.ok(created.every((row) => row.status === "OPEN"));

  // Same feed, second run: everything is a touch, nothing duplicates.
  const second = await syncJobSource({
    sourceId: source.id, triggeredBy: "test", adapters: { "test-adapter": adapter },
    idempotencyKey: `${STAMP}-run-2`,
  });
  assert.equal(second.totals.itemsUnchanged, 2);
  assert.equal(second.totals.itemsCreated, 0);
  assert.equal(second.totals.itemsUpdated, 0);
  assert.equal((await openingsOf(source.id)).length, 2, "a repeated sync must never duplicate an opening");
  assert.equal(requests.length, 2);
});

test("a changed record updates in place and bumps nothing else", async () => {
  const source = await createSource({ slug: "changed" });
  const first = fakeAdapter([{ items: [record()] }]);
  await syncJobSource({ sourceId: source.id, triggeredBy: "test", adapters: { "test-adapter": first.adapter }, idempotencyKey: `${STAMP}-c1` });
  const [before] = await openingsOf(source.id);

  const second = fakeAdapter([{ items: [record({ role: "Senior Data Analyst", city: "Bandung" })] }]);
  const result = await syncJobSource({ sourceId: source.id, triggeredBy: "test", adapters: { "test-adapter": second.adapter }, idempotencyKey: `${STAMP}-c2` });
  assert.equal(result.totals.itemsUpdated, 1);

  const [after] = await openingsOf(source.id);
  assert.equal(after.id, before.id, "an update must keep the same row");
  assert.equal(after.title, "Senior Data Analyst");
  assert.equal(after.location, "Bandung");
  assert.notEqual(after.contentHash, before.contentHash);
  assert.notEqual(after.canonicalKey, before.canonicalKey, "canonical identity follows title/company/location");
  assert.equal(after.firstSeenAt.getTime(), before.firstSeenAt.getTime(), "history is preserved");
});

test("pagination walks the cursor and persists a checkpoint when it stops early", async () => {
  const source = await createSource({ slug: "paged" });
  const { adapter, requests } = fakeAdapter([
    { items: [record({ id: "p-1" })] },
    { items: [record({ id: "p-2" })] },
    { items: [record({ id: "p-3" })] },
  ]);
  const full = await syncJobSource({ sourceId: source.id, triggeredBy: "test", adapters: { "test-adapter": adapter }, idempotencyKey: `${STAMP}-p1` });
  assert.equal(full.totals.pagesFetched, 3);
  assert.equal(full.totals.itemsCreated, 3);
  assert.deepEqual(requests.map((request) => request.cursor), [null, "1", "2"]);
  assert.equal(full.cursor, null, "a completed pass starts the next sync from the top");

  // A budget that runs out mid-feed stops cleanly and records where it got to.
  const partialSource = await createSource({ slug: "partial" });
  const clock = (() => { let value = 0; return { now: () => (value += 20_000) }; })();
  const partial = await syncJobSource({
    sourceId: partialSource.id, triggeredBy: "test", idempotencyKey: `${STAMP}-p2`,
    adapters: { "test-adapter": fakeAdapter([{ items: [record({ id: "q-1" })] }, { items: [record({ id: "q-2" })] }, { items: [record({ id: "q-3" })] }]).adapter },
    budget: createExecutionBudget(45_000, { now: clock.now }),
  });
  assert.equal(partial.status, "PARTIAL", "a sync that did not finish must not report success");
  assert.ok(partial.totals.pagesFetched < 3);
  const [stored] = await db.select().from(schema.jobSources).where(eq(schema.jobSources.id, partialSource.id));
  assert.equal(stored.cursor, partial.cursor, "the checkpoint is persisted so the next tick resumes");
  assert.ok(stored.cursor !== null);
});

test("a malformed record is counted and skipped without costing the sync", async () => {
  const source = await createSource({ slug: "malformed" });
  const { adapter } = fakeAdapter([{
    items: [record({ id: "ok-1" }), record({ id: "bad-1", apply: "http://insecure.invalid/x" }), { nothing: true }, record({ id: "ok-2" })],
  }]);
  const result = await syncJobSource({ sourceId: source.id, triggeredBy: "test", adapters: { "test-adapter": adapter }, idempotencyKey: `${STAMP}-m1` });
  assert.equal(result.status, "SUCCESS", "one bad row must not fail an otherwise good sync");
  assert.equal(result.totals.itemsInvalid, 2);
  assert.equal(result.totals.itemsCreated, 2);
  assert.deepEqual((await openingsOf(source.id)).map((row) => row.externalId), ["ok-1", "ok-2"]);
});

test("a feed failure never closes openings, and a completed sweep grades absence", async () => {
  const source = await createSource({ slug: "absence" });
  await syncJobSource({
    sourceId: source.id, triggeredBy: "test", idempotencyKey: `${STAMP}-a1`,
    adapters: { "test-adapter": fakeAdapter([{ items: [record({ id: "a-1" }), record({ id: "a-2" })] }]).adapter },
  });

  // The provider breaks. Nothing may be closed on the strength of a failure.
  const broken = await syncJobSource({
    sourceId: source.id, triggeredBy: "test", idempotencyKey: `${STAMP}-a2`,
    adapters: { "test-adapter": fakeAdapter([{ throw: new Error("upstream exploded") }]).adapter },
  });
  assert.equal(broken.status, "FAILED");
  assert.equal(broken.totals.itemsClosed, 0);
  assert.ok((await openingsOf(source.id)).every((row) => row.status === "OPEN"), "a provider outage must not close a board");

  // A clean sweep that no longer lists a-2, run far enough in the future for
  // the staleness window to have elapsed twice over.
  const later = new Date(Date.now() + 10 * 86_400_000);
  const swept = await syncJobSource({
    sourceId: source.id, triggeredBy: "test", now: later, idempotencyKey: `${STAMP}-a3`,
    adapters: { "test-adapter": fakeAdapter([{ items: [record({ id: "a-1" })] }]).adapter },
  });
  assert.equal(swept.status, "SUCCESS");
  assert.equal(swept.totals.itemsClosed, 1);
  const rows = await openingsOf(source.id);
  assert.equal(rows.find((row) => row.externalId === "a-1").status, "OPEN");
  assert.equal(rows.find((row) => row.externalId === "a-2").status, "CLOSED");
  assert.equal(rows.length, 2, "a closed opening is kept, never deleted");
});

test("an expired opening is expired on sight and stops being recommendable", async () => {
  const source = await createSource({ slug: "expiry" });
  const result = await syncJobSource({
    sourceId: source.id, triggeredBy: "test", idempotencyKey: `${STAMP}-e1`,
    adapters: { "test-adapter": fakeAdapter([{ items: [record({ id: "e-1", expires: "2020-01-01T00:00:00Z" })] }]).adapter },
  });
  assert.equal(result.totals.itemsCreated, 1);
  const [row] = await openingsOf(source.id);
  assert.equal(row.status, "EXPIRED");
});

test("two concurrent syncs of one source do not both run", async () => {
  const source = await createSource({ slug: "concurrent" });
  const first = fakeAdapter([{ items: [record({ id: "c-1" })] }]);
  const second = fakeAdapter([{ items: [record({ id: "c-2" })] }]);
  const [a, b] = await Promise.all([
    syncJobSource({ sourceId: source.id, triggeredBy: "test-a", adapters: { "test-adapter": first.adapter }, idempotencyKey: `${STAMP}-cc1` }),
    syncJobSource({ sourceId: source.id, triggeredBy: "test-b", adapters: { "test-adapter": second.adapter }, idempotencyKey: `${STAMP}-cc2` }),
  ]);
  const skipped = [a, b].filter((outcome) => outcome.status === "SKIPPED");
  assert.equal(skipped.length, 1, "exactly one caller must lose the lease");
  assert.match(skipped[0].skipped, /lease/i);
  assert.equal((await openingsOf(source.id)).length, 1);
});

test("a held lease blocks a second worker until it expires", async () => {
  const source = await createSource({ slug: "lease" });
  const now = new Date();
  const held = await leaseSource(source.id, now, db);
  assert.ok(held);
  assert.equal(await leaseSource(source.id, now, db), null);
  // Once the lease is past, another worker may take it.
  const later = new Date(now.getTime() + 11 * 60_000);
  assert.ok(await leaseSource(source.id, later, db));
});

test("only active, due sources are swept, and a disabled one stops being recommended", async () => {
  const active = await createSource({ slug: "due-active" });
  const inactive = await createSource({ slug: "due-inactive", row: { isActive: false } });
  const { adapter } = fakeAdapter([{ items: [record({ id: "d-1" })] }]);
  const { synced } = await syncDueJobSources({ triggeredBy: "test", adapters: { "test-adapter": adapter } });
  const slugs = synced.map((outcome) => outcome.sourceSlug);
  assert.ok(slugs.includes(active.slug));
  assert.equal(slugs.includes(inactive.slug), false, "an inactive source is never synced");

  await setJobSourceActive({ sourceId: active.id, isActive: false, actorSubject: "test-admin" });
  const [row] = await db.select().from(schema.jobSources).where(eq(schema.jobSources.id, active.id));
  assert.equal(row.isActive, false);
  // Disabling stops new data; it does not claim every role it listed has closed.
  assert.ok((await openingsOf(active.id)).every((opening) => opening.status !== "CLOSED"));
});

test("source status reports health and the credential's NAME, never its value", async () => {
  const secretValue = "super-secret-token-value";
  const source = await createSource({ slug: "status", row: { credentialEnvVar: `${STAMP}_TOKEN`.toUpperCase().replace(/-/g, "_") } });
  process.env[source.credentialEnvVar] = secretValue;
  try {
    assert.equal(resolveCredential(source), secretValue);
    const rows = await getJobSourceStatus();
    const row = rows.find((entry) => entry.id === source.id);
    assert.equal(row.credentialEnvVar, source.credentialEnvVar);
    assert.equal(row.credentialConfigured, true);
    assert.equal(JSON.stringify(row).includes(secretValue), false, "a credential must never reach an admin payload");
  } finally {
    delete process.env[source.credentialEnvVar];
  }
  // A named-but-missing credential is a hard error: syncing a private feed
  // unauthenticated returns an empty page, which looks like "everything closed".
  assert.throws(() => resolveCredential(source), /not set/i);
});

test("a plaintext feed is refused outside the local sandbox", () => {
  const loopback = { baseUrl: "http://127.0.0.1:9999/jobs" };
  assert.doesNotThrow(() => assertFeedTransportAllowed(loopback, process.env));
  assert.throws(
    () => assertFeedTransportAllowed(loopback, { ...process.env, ARENA_LOCAL_SANDBOX: "" }),
    /local sandbox/i,
  );
  assert.doesNotThrow(() => assertFeedTransportAllowed({ baseUrl: "https://feed.example.com" }, { ...process.env, ARENA_LOCAL_SANDBOX: "" }));
});

test("the participant view serves only OPEN openings from active sources", async () => {
  // A user with no finalized evidence: coverage must be null, never 0%.
  const [user] = await db.insert(schema.users).values({ authSubject: `${STAMP}-viewer` }).returning();
  fixture.userId = user.id;

  const source = await createSource({ slug: "overview" });
  await syncJobSource({
    sourceId: source.id, triggeredBy: "test", idempotencyKey: `${STAMP}-o1`,
    adapters: { "test-adapter": fakeAdapter([{
      items: [
        record({ id: "o-open", skills_required: [fixture.sqlSkill.name, "Unmapped Skill"] }),
        record({ id: "o-expired", role: "Expired role", expires: "2020-01-01T00:00:00Z" }),
      ],
    }]).adapter },
  });

  // Scoped to this source: the participant view is paged, and other suites'
  // openings in the shared sandbox may fill the first page.
  const overview = await getJobsOverview(user.id, { filters: { sourceSlug: source.slug } });
  const mine = overview.jobs.filter((job) => job.sourceSlug === source.slug);
  assert.equal(mine.length, 1, "an expired opening must not reach a participant");
  assert.equal(mine[0].title, "Junior Data Analyst");
  assert.equal(mine[0].matchScore, null, "no finalized evidence means no score, not zero");
  assert.equal(mine[0].unscoredReason, "NO_EVIDENCE");
  // The taxonomy-resolved skill is linked; the unmapped one is reported as such.
  assert.deepEqual(mine[0].skills.map((skill) => skill.name), [fixture.sqlSkill.name]);
  assert.deepEqual(mine[0].unresolvedSkills, ["Unmapped Skill"]);
  assert.equal(mine[0].applicationUrl.startsWith("https://"), true);

  const health = overview.sources.find((entry) => entry.slug === source.slug);
  assert.ok(health, "the participant view names its sources");
  assert.equal(health.health, "HEALTHY");
  assert.equal(typeof health.freshnessMinutes, "number");
});

test("a deadline the database already holds hides an opening before any sync marks it EXPIRED", async () => {
  const now = new Date();
  const source = await createSource({ slug: "deadline", row: { lastSuccessfulSyncAt: now } });
  const opening = (externalId, expiresAt) => ({
    sourceId: source.id, externalId, canonicalKey: `${STAMP}-deadline-${externalId}`, title: `Deadline ${externalId}`,
    company: "Fixture Co", applicationUrl: `https://example.invalid/${externalId}`, contentHash: externalId,
    status: "OPEN", postedAt: now, lastSeenAt: now, expiresAt,
  });
  const inserted = await db.insert(schema.jobOpenings).values([
    opening("past", new Date(now.getTime() - 60_000)),
    opening("future", new Date(now.getTime() + 86_400_000)),
    opening("open-ended", null),
  ]).returning();
  const idOf = Object.fromEntries(inserted.map((row) => [row.externalId, row.id]));

  const overview = await getJobsOverview(fixture.userId, { now, filters: { sourceSlug: source.slug } });
  const shown = overview.jobs.map((job) => job.id);
  assert.equal(shown.includes(idOf.past), false, "a role past its deadline must not be offered as live");
  assert.ok(shown.includes(idOf.future));
  assert.ok(shown.includes(idOf["open-ended"]));
  assert.equal(overview.totalMatching, 2);
  assert.equal(overview.sources.find((entry) => entry.slug === source.slug).openOpenings, 2);
  const [stored] = await db.select().from(schema.jobOpenings).where(eq(schema.jobOpenings.id, idOf.past));
  assert.equal(stored.status, "OPEN", "premise: no sync has marked it EXPIRED yet");
});

test("search, paging and the open total reach openings beyond the first 200", async () => {
  const source = await createSource({ slug: "beyond-200" });
  const needle = `${STAMP}-needle`;
  const opening = (key, postedAt) => ({
    sourceId: source.id, externalId: `b-${key}`, canonicalKey: `${STAMP}-b-${key}`, title: `Bulk role ${key}`,
    company: "Fixture Co", applicationUrl: `https://example.invalid/b-${key}`, contentHash: `b-${key}`, status: "OPEN", postedAt,
  });
  await db.insert(schema.jobOpenings).values(Array.from({ length: 205 }, (_, i) => opening(i, new Date(Date.UTC(2099, 0, 1, 0, 0, i)))));
  // The oldest opening: the one a 200-row cap cut off before search or matching ever saw it.
  const [oldest] = await db.insert(schema.jobOpenings).values({
    ...opening("oldest", new Date("2001-01-01T00:00:00Z")), title: `Legacy analyst ${needle}`, requiredSkills: [fixture.excelSkill.name],
  }).returning();
  await db.insert(schema.jobOpeningSkills).values({ jobOpeningId: oldest.id, skillId: fixture.excelSkill.id, kind: "REQUIRED", matchedAlias: fixture.excelSkill.name });

  const scoped = { sourceSlug: source.slug };
  const first = await getJobsOverview(fixture.userId, { filters: scoped });
  assert.equal(first.totalMatching, 206);
  assert.ok(first.totalOpen >= 206, "the open total is counted in SQL, not the length of a page");
  assert.equal(first.sources.find((entry) => entry.slug === source.slug).openOpenings, 206);
  assert.equal(first.jobs.length, 30);
  assert.equal(first.hasMore, true);

  const byTitle = await getJobsOverview(fixture.userId, { filters: { ...scoped, search: needle } });
  assert.deepEqual(byTitle.jobs.map((job) => job.id), [oldest.id]);
  const bySkill = await getJobsOverview(fixture.userId, { filters: { ...scoped, search: fixture.excelSkill.name } });
  assert.ok(bySkill.jobs.some((job) => job.id === oldest.id), "a resolved skill name finds the opening too");

  const seen = new Set();
  for (let offset = 0; ; offset += 100) {
    const page = await getJobsOverview(fixture.userId, { filters: scoped, offset, limit: 100 });
    for (const job of page.jobs) seen.add(job.id);
    if (!page.hasMore) break;
  }
  assert.equal(seen.size, 206, "paging reaches every visible opening exactly once");
  assert.ok(seen.has(oldest.id));
});

test("a curated alias makes a provider's spelling resolve to the same skill", async () => {
  await db.insert(schema.skillAliases).values({ skillId: fixture.excelSkill.id, alias: "ms excel", source: "jobs" });
  const source = await createSource({ slug: "alias" });
  await syncJobSource({
    sourceId: source.id, triggeredBy: "test", idempotencyKey: `${STAMP}-al1`,
    adapters: { "test-adapter": fakeAdapter([{ items: [record({ id: "al-1", skills_required: ["MS-Excel!"] })] }]).adapter },
  });
  const [opening] = await openingsOf(source.id);
  const links = await db.select().from(schema.jobOpeningSkills).where(eq(schema.jobOpeningSkills.jobOpeningId, opening.id));
  assert.equal(links.length, 1, "an alias must resolve a provider spelling to the taxonomy");
  assert.equal(links[0].skillId, fixture.excelSkill.id);
  assert.equal(links[0].matchedAlias, "MS-Excel!");
});

test("every sync writes a run row and an audit entry, and neither carries a payload", async () => {
  const source = await createSource({ slug: "audit" });
  const result = await syncJobSource({
    sourceId: source.id, triggeredBy: "admin:test-operator", idempotencyKey: `${STAMP}-au1`,
    adapters: { "test-adapter": fakeAdapter([{ items: [record({ id: "au-1" })] }]).adapter },
  });
  const runs = await db.select().from(schema.jobSyncRuns).where(eq(schema.jobSyncRuns.sourceId, source.id));
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, "SUCCESS");
  assert.equal(runs[0].triggeredBy, "admin:test-operator");
  assert.equal(runs[0].itemsCreated, 1);
  assert.equal(runs[0].id, result.runId);

  const logs = await db.select().from(schema.logs)
    .where(and(eq(schema.logs.action, "JOBS_SYNC"), eq(schema.logs.entityId, source.id)));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actorType, "ADMIN");
  const serialized = JSON.stringify(logs[0].metadata);
  // Totals and codes only: no feed records, no URLs, no credentials.
  assert.equal(serialized.includes("example.invalid"), false);
  assert.equal(serialized.includes("Junior Data Analyst"), false);
  assert.match(serialized, /itemsCreated/);
});

test("a repeated trigger with the same key resumes one run instead of forking two", async () => {
  const source = await createSource({ slug: "idem-key" });
  const key = `${STAMP}-same-key`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await syncJobSource({
      sourceId: source.id, triggeredBy: "test", idempotencyKey: key,
      adapters: { "test-adapter": fakeAdapter([{ items: [record({ id: "k-1" })] }]).adapter },
    });
  }
  const runs = await db.select().from(schema.jobSyncRuns).where(eq(schema.jobSyncRuns.sourceId, source.id));
  assert.equal(runs.length, 1, "the idempotency key must collapse repeated triggers onto one run");
  assert.equal((await openingsOf(source.id)).length, 1);
});

// ---------------------------------------------------------------- API routes

const ADMIN_TOKEN = `jobs-it-admin-${randomUUID()}`;
process.env.INTERNAL_ADMIN_TOKEN = ADMIN_TOKEN;
process.env.INTERNAL_ADMIN_SUBJECT = `${STAMP}-operator`;
process.env.INTERNAL_ADMIN_SCOPES = "careers overview";

const adminSourcesRoute = await import("../src/app/api/internal/admin/job-sources/route.ts");
const participantJobsRoute = await import("../src/app/api/career/jobs/route.ts");

const adminRequest = (method, body) => new Request("https://arena.test/api/internal/admin/job-sources", {
  method,
  headers: { "content-type": "application/json", authorization: `Bearer ${ADMIN_TOKEN}` },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test("the admin job-sources route is bearer-gated and scope-gated", async () => {
  // 403 FORBIDDEN, not 401: the guard refuses on authorization, and its answer
  // is identical whether the caller had no credential or the wrong one, so the
  // status never distinguishes "token exists" from "token is wrong".
  const anonymous = await adminSourcesRoute.GET(new Request("https://arena.test/api/internal/admin/job-sources"));
  assert.equal(anonymous.status, 403, "an unauthenticated read must not reveal source configuration");

  const wrongToken = await adminSourcesRoute.GET(new Request("https://arena.test/api/internal/admin/job-sources", {
    headers: { authorization: "Bearer definitely-not-the-token" },
  }));
  assert.equal(wrongToken.status, 403);
  assert.equal(JSON.stringify(await wrongToken.json()), JSON.stringify(await anonymous.clone().json()));

  const previousScopes = process.env.INTERNAL_ADMIN_SCOPES;
  process.env.INTERNAL_ADMIN_SCOPES = "overview";
  try {
    const wrongScope = await adminSourcesRoute.GET(adminRequest("GET"));
    assert.equal(wrongScope.status, 403, "the careers scope must actually be required");
  } finally {
    process.env.INTERNAL_ADMIN_SCOPES = previousScopes;
  }
});

test("the admin job-sources route reports status and runs a manual sync", async () => {
  const source = await createSource({ slug: "route" });
  const listed = await adminSourcesRoute.GET(adminRequest("GET"));
  assert.equal(listed.status, 200);
  const body = await listed.json();
  const row = body.data.sources.find((entry) => entry.id === source.id);
  assert.ok(row, "the route must list the source");
  assert.equal(row.isActive, true);

  const disabled = await adminSourcesRoute.POST(adminRequest("POST", { sourceId: source.id, action: "disable" }));
  assert.equal(disabled.status, 200);
  assert.equal((await disabled.json()).data.result.isActive, false);

  const unknown = await adminSourcesRoute.POST(adminRequest("POST", { sourceId: source.id, action: "delete-everything" }));
  assert.equal(unknown.status, 400);
  const malformed = await adminSourcesRoute.POST(adminRequest("POST", { sourceId: "not-a-uuid", action: "sync" }));
  assert.equal(malformed.status, 400);
});

test("the participant jobs route refuses an unauthenticated reader", async () => {
  // Openings are only meaningful next to someone's evidence, and the evidence
  // is personal — so this route has no anonymous mode at all.
  const response = await participantJobsRoute.GET();
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.data, undefined);
});
