// The Jobs ingestion pipeline, without a vendor.
//
// Everything here runs against an injected fetch or a loopback fixture server,
// never a real provider: a test suite that depends on a live job board tells
// you about the board's uptime, not about this code.
//
// The rule most of these assertions defend: a number or a label on a job card
// is a claim. Where a feed did not supply the fact, the answer is "we do not
// know" — not a plausible default that reads exactly like a real one.
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  canonicalKey, contentHash, normalizeOpening, normalizeText,
  parseEmploymentType, parseWorkMode, safeApplicationUrl,
} from "../src/server/career/jobs/normalize.ts";
import { createHttpJsonAdapter, JobsFeedError, parseRetryAfter } from "../src/server/career/jobs/http-adapter.ts";
import { httpJsonSourceConfigSchema } from "../src/server/career/jobs/contract.ts";
import {
  classifyRun, emptyTotals, freshnessMinutes, isRecommendable, isSourceDue,
  planAbsence, planUpsert, sourceHealth, statusForSeen,
} from "../src/server/career/jobs/sync-core.ts";
import { computeCoverage, filterOpenings, rankByCoverage, safeJobsPortalUrl } from "../src/server/career/jobs/matching-core.ts";

const fieldMap = {
  externalId: "id", title: "role", company: "company.name", location: "city",
  workMode: "arrangement", employmentType: "contract", description: "summary",
  requiredSkills: "skills_required", preferredSkills: "skills_nice",
  applicationUrl: "apply", postedAt: "posted", expiresAt: "expires",
  salaryMin: "pay.min", salaryMax: "pay.max", salaryCurrency: "pay.currency", salaryPeriod: "pay.period",
};

const record = (over = {}) => ({
  id: "fx-1", role: "Junior Data Analyst", company: { name: "Studio Contoh" }, city: "Jakarta",
  arrangement: "Hybrid", contract: "Full-time", summary: "Menyusun laporan margin per kanal.",
  skills_required: "SQL, Excel", apply: "https://example.invalid/fx-1",
  posted: "2026-09-01T02:00:00Z", pay: { min: 6000000, max: 9000000, currency: "idr", period: "month" },
  ...over,
});

// ------------------------------------------------------------ normalization

test("a well-formed record normalizes every field it actually supplied", () => {
  const result = normalizeOpening(record(), fieldMap);
  assert.equal(result.ok, true);
  const job = result.opening;
  assert.equal(job.externalId, "fx-1");
  assert.equal(job.title, "Junior Data Analyst");
  assert.equal(job.company, "Studio Contoh");
  assert.equal(job.workMode, "HYBRID");
  assert.equal(job.employmentType, "FULL_TIME");
  assert.deepEqual(job.requiredSkills, ["SQL", "Excel"]);
  assert.equal(job.applicationUrl, "https://example.invalid/fx-1");
  assert.equal(job.postedAt.toISOString(), "2026-09-01T02:00:00.000Z");
  assert.equal(job.salaryMin, 6000000);
  assert.equal(job.salaryCurrency, "IDR");
  assert.ok(job.contentHash.length === 64);
});

test("a field the feed did not supply stays unknown instead of becoming a default", () => {
  const sparse = normalizeOpening({ id: "x", role: "Analyst", company: { name: "Co" }, apply: "https://example.invalid/x" }, fieldMap);
  assert.equal(sparse.ok, true);
  // UNSPECIFIED, not FULL_TIME/ONSITE: a card must not tell a participant a
  // role is on-site full-time when the provider never said so.
  assert.equal(sparse.opening.workMode, "UNSPECIFIED");
  assert.equal(sparse.opening.employmentType, "UNSPECIFIED");
  assert.equal(sparse.opening.location, null);
  assert.equal(sparse.opening.postedAt, null);
  assert.equal(sparse.opening.salaryMin, null);
  assert.deepEqual(sparse.opening.requiredSkills, []);
});

test("malformed records are rejected with a reason, never guessed at", () => {
  for (const [over, reason] of [
    [{ id: null }, /external id/i],
    [{ role: "" }, /title/i],
    [{ company: {} }, /company/i],
    [{ apply: "http://example.invalid/x" }, /application URL/i],
    [{ apply: "javascript:alert(1)" }, /application URL/i],
    [{ apply: "https://user:pass@example.invalid/x" }, /application URL/i],
    [{ apply: null }, /application URL/i],
  ]) {
    const result = normalizeOpening(record(over), fieldMap);
    assert.equal(result.ok, false, JSON.stringify(over));
    assert.match(result.reason, reason);
  }
  assert.equal(normalizeOpening(null, fieldMap).ok, false);
  assert.equal(normalizeOpening("not an object", fieldMap).ok, false);
  assert.equal(normalizeOpening([], fieldMap).ok, false);
});

test("work mode and employment type read Indonesian as well as English", () => {
  assert.equal(parseWorkMode("Kerja jarak jauh"), "REMOTE");
  assert.equal(parseWorkMode("WFH"), "REMOTE");
  assert.equal(parseWorkMode("Di kantor"), "ONSITE");
  assert.equal(parseWorkMode("Hybrid"), "HYBRID");
  assert.equal(parseWorkMode("negotiable"), "UNSPECIFIED");
  assert.equal(parseWorkMode(null), "UNSPECIFIED");
  assert.equal(parseEmploymentType("Magang"), "INTERNSHIP");
  assert.equal(parseEmploymentType("Penuh waktu"), "FULL_TIME");
  assert.equal(parseEmploymentType("Paruh waktu"), "PART_TIME");
  assert.equal(parseEmploymentType("Kontrak"), "CONTRACT");
  assert.equal(parseEmploymentType("anything else"), "UNSPECIFIED");
});

test("skills are deduplicated case-insensitively and bounded", () => {
  const result = normalizeOpening(record({ skills_required: ["SQL", "sql", " SQL ", "Excel"] }), fieldMap);
  assert.deepEqual(result.opening.requiredSkills, ["SQL", "Excel"]);
  const many = normalizeOpening(record({ skills_required: Array.from({ length: 100 }, (_, i) => `skill-${i}`) }), fieldMap);
  assert.equal(many.opening.requiredSkills.length, 40);
});

test("a salary range reported backwards is repaired rather than dropped", () => {
  const swapped = normalizeOpening(record({ pay: { min: 9000000, max: 6000000, currency: "IDR" } }), fieldMap);
  assert.equal(swapped.opening.salaryMin, 6000000);
  assert.equal(swapped.opening.salaryMax, 9000000);
  const nonsense = normalizeOpening(record({ pay: { min: "not a number", max: 1e15 } }), fieldMap);
  assert.equal(nonsense.opening.salaryMin, null);
  assert.equal(nonsense.opening.salaryMax, null);
});

test("an implausible date is discarded instead of stored", () => {
  assert.equal(normalizeOpening(record({ posted: "not a date" }), fieldMap).opening.postedAt, null);
  assert.equal(normalizeOpening(record({ posted: "1673-01-01" }), fieldMap).opening.postedAt, null);
});

test("canonical identity is provider-independent and content hash tracks visible change", () => {
  const a = normalizeOpening(record(), fieldMap).opening;
  const b = normalizeOpening(record({ id: "other-provider-id" }), fieldMap).opening;
  // Same role from two boards: different provider ids, one canonical key.
  assert.equal(a.canonicalKey, b.canonicalKey);
  assert.notEqual(a.externalId, b.externalId);
  assert.equal(canonicalKey({ title: "Junior Data Analyst", company: "studio contoh", location: "JAKARTA" }), a.canonicalKey);

  const retitled = normalizeOpening(record({ role: "Senior Data Analyst" }), fieldMap).opening;
  assert.notEqual(a.contentHash, retitled.contentHash);
  assert.equal(a.contentHash, normalizeOpening(record(), fieldMap).opening.contentHash, "hashing must be stable");
  assert.equal(contentHash({ ...a, contentHash: undefined }), a.contentHash);
});

test("application URLs are held to the same rule as every outbound link", () => {
  assert.equal(safeApplicationUrl("https://jobs.example.com/x"), "https://jobs.example.com/x");
  for (const value of [null, "", "/relative", "//example.com", "http://example.com", "javascript:alert(1)", "data:text/html,hi", "https://u:p@example.com"]) {
    assert.equal(safeApplicationUrl(value), null, String(value));
  }
});

// ------------------------------------------------------------- HTTP adapter

async function fixtureServer(handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

function config(over = {}) {
  return httpJsonSourceConfigSchema.parse({
    baseUrl: "https://feed.example.com/jobs",
    itemsPath: "data.items", nextCursorPath: "data.next", cursorParam: "page",
    fieldMap, maxAttempts: 3, timeoutMs: 2_000, maxPages: 10, ...over,
  });
}

test("the source config schema refuses feeds that could leak or be spoofed", () => {
  assert.throws(() => config({ baseUrl: "http://feed.example.com/jobs" }), /HTTPS|invalid/i);
  assert.throws(() => config({ baseUrl: "https://user:pass@feed.example.com/jobs" }), /HTTPS|invalid/i);
  assert.throws(() => httpJsonSourceConfigSchema.parse({ baseUrl: "https://feed.example.com", fieldMap: { title: "t" } }));
  // A field map missing its identity columns cannot produce a usable row.
  assert.throws(() => config({ fieldMap: { title: "role", company: "c", applicationUrl: "a" } }));
});

test("pagination follows the provider's cursor and stops when it ends", async () => {
  const pages = {
    "": { data: { items: [{ id: 1 }, { id: 2 }], next: "p2" } },
    p2: { data: { items: [{ id: 3 }], next: null } },
  };
  const seen = [];
  const adapter = createHttpJsonAdapter({
    fetchImpl: async (url) => {
      const cursor = new URL(url).searchParams.get("page") ?? "";
      seen.push(cursor);
      return new Response(JSON.stringify(pages[cursor]), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const first = await adapter.fetchPage({ config: config() });
  assert.equal(first.items.length, 2);
  assert.equal(first.nextCursor, "p2");
  const second = await adapter.fetchPage({ config: config(), cursor: first.nextCursor });
  assert.equal(second.items.length, 1);
  assert.equal(second.nextCursor, null);
  assert.deepEqual(seen, ["", "p2"]);
});

test("a credential is sent in the configured header and never in the URL", async () => {
  let captured;
  const adapter = createHttpJsonAdapter({
    fetchImpl: async (url, init) => {
      captured = { url: url.toString(), auth: init.headers.get("authorization") };
      return new Response(JSON.stringify({ data: { items: [] } }), { status: 200 });
    },
  });
  await adapter.fetchPage({
    config: config({ authHeader: "Authorization", authScheme: "Bearer " }),
    credential: "secret-token-value",
  });
  assert.equal(captured.auth, "Bearer secret-token-value");
  assert.equal(captured.url.includes("secret-token-value"), false, "a token must never reach the query string");
});

test("transient failures are retried with backoff; permanent ones are not", async () => {
  let calls = 0;
  const slept = [];
  const flaky = createHttpJsonAdapter({
    sleep: async (ms) => { slept.push(ms); },
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) return new Response("upstream boom", { status: 503 });
      return new Response(JSON.stringify({ data: { items: [{ id: 1 }] } }), { status: 200 });
    },
  });
  const page = await flaky.fetchPage({ config: config() });
  assert.equal(calls, 3);
  assert.equal(page.items.length, 1);
  assert.ok(slept.length === 2 && slept[1] > slept[0], "backoff must grow");

  let permanentCalls = 0;
  const permanent = createHttpJsonAdapter({
    sleep: async () => {},
    fetchImpl: async () => { permanentCalls += 1; return new Response("nope", { status: 403 }); },
  });
  await assert.rejects(() => permanent.fetchPage({ config: config() }), (error) => {
    assert.ok(error instanceof JobsFeedError);
    assert.equal(error.code, "FEED_HTTP_403");
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal(permanentCalls, 1, "a 403 must not be retried");
});

test("a rate limit is obeyed as the provider stated it, not guessed", async () => {
  const slept = [];
  let calls = 0;
  const adapter = createHttpJsonAdapter({
    sleep: async (ms) => { slept.push(ms); },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return new Response("slow down", { status: 429, headers: { "retry-after": "2" } });
      return new Response(JSON.stringify({ data: { items: [] } }), { status: 200 });
    },
  });
  await adapter.fetchPage({ config: config() });
  assert.deepEqual(slept, [2000]);
  assert.equal(parseRetryAfter("5"), 5000);
  assert.equal(parseRetryAfter("9999"), 60_000, "a hostile Retry-After is clamped");
  assert.equal(parseRetryAfter("garbage"), undefined);
  assert.equal(parseRetryAfter(null), undefined);
});

test("a malformed body fails loudly rather than being read as an empty feed", async () => {
  // An empty feed and an unparseable one look identical downstream, and one of
  // them would close every opening the source has.
  for (const [body, code] of [
    ["not json at all", "FEED_NOT_JSON"],
    [JSON.stringify({ data: { items: "nope" } }), "FEED_SHAPE_INVALID"],
    [JSON.stringify({ nothing: true }), "FEED_SHAPE_INVALID"],
  ]) {
    const adapter = createHttpJsonAdapter({ sleep: async () => {}, fetchImpl: async () => new Response(body, { status: 200 }) });
    await assert.rejects(() => adapter.fetchPage({ config: config() }), (error) => {
      assert.equal(error.code, code);
      return true;
    });
  }
});

test("the caller's budget ends the read, even mid-retry", async () => {
  const controller = new AbortController();
  const adapter = createHttpJsonAdapter({
    sleep: async () => { controller.abort(); },
    fetchImpl: async () => new Response("boom", { status: 503 }),
  });
  await assert.rejects(
    () => adapter.fetchPage({ config: config(), signal: controller.signal }),
    (error) => {
      assert.ok(["FEED_BUDGET_EXCEEDED", "FEED_HTTP_503"].includes(error.code));
      return true;
    },
  );
});

test("end to end against a loopback fixture server, over real HTTP", async () => {
  const server = await fixtureServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const page = url.searchParams.get("page") ?? "0";
    const items = page === "0" ? [record(), record({ id: "fx-2", role: "BI Intern" })] : [record({ id: "fx-3" })];
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: { items, next: page === "0" ? "1" : null } }));
  });
  try {
    // The HTTPS rule is a schema rule on stored config; the adapter itself is
    // transport-agnostic, which is what lets a loopback fixture stand in here.
    const adapter = createHttpJsonAdapter();
    const first = await adapter.fetchPage({ config: { ...config(), baseUrl: `${server.url}/jobs` }, cursor: "0" });
    assert.equal(first.items.length, 2);
    assert.equal(first.nextCursor, "1");
    const normalized = first.items.map((item) => normalizeOpening(item, fieldMap));
    assert.ok(normalized.every((item) => item.ok));
    assert.deepEqual(normalized.map((item) => item.opening.externalId), ["fx-1", "fx-2"]);
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------- lifecycle

const existing = (over = {}) => ({
  id: "row-1", externalId: "fx-1", contentHash: "hash-a", status: "OPEN",
  lastSeenAt: new Date("2026-09-01T00:00:00Z"), expiresAt: null, ...over,
});
const now = new Date("2026-09-10T00:00:00Z");

test("an unchanged record is a touch, a changed one an update, a new one a create", () => {
  const opening = { ...normalizeOpening(record(), fieldMap).opening, contentHash: "hash-a", expiresAt: null };
  assert.equal(planUpsert(opening, undefined, now).action, "create");
  assert.equal(planUpsert(opening, existing(), now).action, "touch");
  assert.equal(planUpsert({ ...opening, contentHash: "hash-b" }, existing(), now).action, "update");
  // A previously closed role that reappears is reopened: the provider knows
  // more than our staleness timer inferred.
  assert.equal(planUpsert(opening, existing({ status: "CLOSED" }), now).action, "update");
  assert.equal(planUpsert(opening, existing({ status: "CLOSED" }), now).status, "OPEN");
});

test("an expiry date the provider gave is respected on sight", () => {
  assert.equal(statusForSeen({ expiresAt: new Date("2026-09-09T00:00:00Z") }, now), "EXPIRED");
  assert.equal(statusForSeen({ expiresAt: new Date("2026-09-11T00:00:00Z") }, now), "OPEN");
  assert.equal(statusForSeen({ expiresAt: null }, now), "OPEN");
});

test("absence is graded, and never acted on after a partial sweep", () => {
  const options = { now, stalenessDays: 3, sweptFully: true };
  // Nine days unseen, staleness three: past stale, past 2x stale — closed.
  assert.equal(planAbsence(existing(), options), "CLOSED");
  assert.equal(planAbsence(existing({ lastSeenAt: new Date("2026-09-06T00:00:00Z") }), options), "STALE");
  assert.equal(planAbsence(existing({ lastSeenAt: new Date("2026-09-09T00:00:00Z") }), options), null);
  assert.equal(planAbsence(existing({ status: "CLOSED" }), options), null);
  assert.equal(
    planAbsence(existing({ expiresAt: new Date("2026-09-05T00:00:00Z"), lastSeenAt: now }), options),
    "EXPIRED",
  );
  // THE rule: a sync that did not finish has no opinion about what is missing.
  // Without it, one failing page would close an entire board.
  assert.equal(planAbsence(existing(), { ...options, sweptFully: false }), null);
});

test("only OPEN openings are recommendable", () => {
  assert.equal(isRecommendable("OPEN"), true);
  for (const status of ["EXPIRED", "STALE", "CLOSED"]) assert.equal(isRecommendable(status), false);
});

test("a run that stopped early is PARTIAL, not SUCCESS", () => {
  const totals = { ...emptyTotals(), pagesFetched: 2 };
  assert.equal(classifyRun(totals, { error: false, completed: true }), "SUCCESS");
  assert.equal(classifyRun(totals, { error: false, completed: false }), "PARTIAL");
  assert.equal(classifyRun(totals, { error: true, completed: false }), "PARTIAL");
  assert.equal(classifyRun(emptyTotals(), { error: true, completed: false }), "FAILED");
});

test("due-ness backs off on repeated failure and disabled sources are never due", () => {
  const base = { isActive: true, syncIntervalMinutes: 60, lastSyncStartedAt: new Date(now.getTime() - 90 * 60_000), consecutiveFailures: 0 };
  assert.equal(isSourceDue(base, now), true);
  assert.equal(isSourceDue({ ...base, isActive: false }, now), false);
  assert.equal(isSourceDue({ ...base, lastSyncStartedAt: null }, now), true);
  assert.equal(isSourceDue({ ...base, lastSyncStartedAt: new Date(now.getTime() - 10 * 60_000) }, now), false);
  assert.equal(isSourceDue({ ...base, consecutiveFailures: 5 }, now), false, "a failing source is retried less often");
});

test("health names the state an operator has to act on", () => {
  const base = { isActive: true, syncIntervalMinutes: 60, consecutiveFailures: 0, lastSuccessfulSyncAt: new Date(now.getTime() - 30 * 60_000) };
  assert.equal(sourceHealth(base, now), "HEALTHY");
  assert.equal(sourceHealth({ ...base, isActive: false }, now), "DISABLED");
  assert.equal(sourceHealth({ ...base, consecutiveFailures: 3 }, now), "FAILING");
  assert.equal(sourceHealth({ ...base, lastSuccessfulSyncAt: null }, now), "NEVER_SYNCED");
  // Works, but the page is showing data older than the source promised — the
  // state that matters most, because nothing looks broken.
  assert.equal(sourceHealth({ ...base, lastSuccessfulSyncAt: new Date(now.getTime() - 5 * 3600_000) }, now), "DEGRADED");
  assert.equal(freshnessMinutes(new Date(now.getTime() - 125 * 60_000), now), 125);
  assert.equal(freshnessMinutes(null, now), null);
});

// ----------------------------------------------------------------- matching

const skill = (id, name, kind = "REQUIRED") => ({ skillId: id, name, kind });

test("coverage is computed from taxonomy ids, not from strings", () => {
  const job = { id: "j1", skills: [skill("s-sql", "SQL"), skill("s-xl", "Excel")], unresolvedSkills: [] };
  const result = computeCoverage(job, new Set(["s-sql"]));
  assert.equal(result.matchScore, 50);
  assert.deepEqual(result.matchedSkills, ["SQL"]);
  assert.deepEqual(result.missingSkills, ["Excel"]);
  assert.equal(result.unscoredReason, null);
});

test("no evidence and no stated skills are different answers, and neither is zero", () => {
  const job = { id: "j1", skills: [skill("s-sql", "SQL")], unresolvedSkills: [] };
  const noEvidence = computeCoverage(job, new Set());
  assert.equal(noEvidence.matchScore, null, "0% would read as 'you match nothing'");
  assert.equal(noEvidence.unscoredReason, "NO_EVIDENCE");
  assert.deepEqual(noEvidence.missingSkills, ["SQL"]);

  const noSkills = computeCoverage({ id: "j2", skills: [], unresolvedSkills: ["Kepemimpinan"] }, new Set(["s-sql"]));
  assert.equal(noSkills.matchScore, null);
  assert.equal(noSkills.unscoredReason, "NO_SKILL_DATA");
  assert.deepEqual(noSkills.taxonomyCoverage, { resolved: 0, total: 1 });
});

test("preferred skills only score when a role states no required ones", () => {
  const preferredOnly = { id: "j1", skills: [skill("s-fig", "Figma", "PREFERRED")], unresolvedSkills: [] };
  assert.equal(computeCoverage(preferredOnly, new Set(["s-fig"])).matchScore, 100);
  const both = { id: "j2", skills: [skill("s-sql", "SQL"), skill("s-fig", "Figma", "PREFERRED")], unresolvedSkills: [] };
  // Only the required skill counts, so having Figma alone scores 0, not 50.
  assert.equal(computeCoverage(both, new Set(["s-fig"])).matchScore, 0);
});

test("unmapped provider skills are reported, not silently inflating the score", () => {
  const job = { id: "j1", skills: [skill("s-sql", "SQL")], unresolvedSkills: ["Stakeholder wrangling", "Vibes"] };
  const result = computeCoverage(job, new Set(["s-sql"]));
  assert.equal(result.matchScore, 100);
  // 100% of what we could map — and the page is told it mapped 1 of 3.
  assert.deepEqual(result.taxonomyCoverage, { resolved: 1, total: 3 });
});

test("filters combine, search reaches skills, and ranking is deterministic", () => {
  const jobs = [
    { id: "b", title: "BI Intern", company: "Lab", location: "Remote", employmentType: "INTERNSHIP", workMode: "REMOTE", sourceSlug: "src", skills: [skill("s-xl", "Excel")], unresolvedSkills: [], matchScore: 50 },
    { id: "a", title: "Data Analyst", company: "Studio", location: "Jakarta", employmentType: "FULL_TIME", workMode: "HYBRID", sourceSlug: "src", skills: [skill("s-sql", "SQL")], unresolvedSkills: ["Vibes"], matchScore: 50 },
    { id: "c", title: "Ops", company: "Sim", location: "Surabaya", employmentType: "FULL_TIME", workMode: "ONSITE", sourceSlug: "other", skills: [], unresolvedSkills: [], matchScore: null },
  ];
  assert.deepEqual(filterOpenings(jobs, { search: "sql" }).map((job) => job.id), ["a"]);
  assert.deepEqual(filterOpenings(jobs, { search: "VIBES" }).map((job) => job.id), ["a"]);
  assert.deepEqual(filterOpenings(jobs, { employmentType: "FULL_TIME" }).map((job) => job.id), ["a", "c"]);
  assert.deepEqual(filterOpenings(jobs, { workMode: "REMOTE" }).map((job) => job.id), ["b"]);
  assert.deepEqual(filterOpenings(jobs, { sourceSlug: "other" }).map((job) => job.id), ["c"]);
  assert.deepEqual(filterOpenings(jobs, { employmentType: "FULL_TIME", location: "Remote" }), []);
  // Equal scores tie-break on id; an unscored job sorts last, never as a zero.
  assert.deepEqual(rankByCoverage(jobs).map((job) => job.id), ["a", "b", "c"]);
});

test("only credential-free HTTPS portal links are exposed", () => {
  assert.equal(safeJobsPortalUrl(), null);
  for (const value of ["", "/jobs", "//example.com", "javascript:alert(1)", "http://example.com", "https://user:pass@example.com", "not a url"]) {
    assert.equal(safeJobsPortalUrl(value), null, value);
  }
  assert.equal(safeJobsPortalUrl("https://jobs.example.com/openings"), "https://jobs.example.com/openings");
});

test("text normalization folds case, accents and punctuation for lookups", () => {
  assert.equal(normalizeText("  MS-Excel!  "), "ms excel");
  assert.equal(normalizeText("Data  Visualization"), "data visualization");
  assert.equal(normalizeText(""), "");
});

// ------------------------------------------------------------ fixture guard

const { createFixtureAdapter } = await import("../src/server/career/jobs/fixture-adapter.ts");

const sandboxEnv = {
  APP_ENV: "development", NODE_ENV: "development", ARENA_LOCAL_SANDBOX: "1",
  SESSION_SECRET: "s".repeat(48),
  DATABASE_URL: "postgres://arena_local:pw@127.0.0.1:55432/arena_local",
  ARENA_ORIGIN: "http://localhost:3001",
};

test("the fixture adapter refuses to run outside the local sandbox", async () => {
  // Fabricated openings shown as live listings is the worst thing this product
  // could display, so the guard is in the adapter itself rather than only in
  // the script that registers it.
  const adapter = createFixtureAdapter({ env: { ...sandboxEnv, ARENA_LOCAL_SANDBOX: "" } });
  await assert.rejects(
    () => adapter.fetchPage({ config: { file: "scripts/fixtures/jobs-feed.json" } }),
    (error) => { assert.equal(error.code, "FORBIDDEN"); return true; },
  );
  const onVercel = createFixtureAdapter({ env: { ...sandboxEnv, VERCEL: "1" } });
  await assert.rejects(() => onVercel.fetchPage({ config: { file: "scripts/fixtures/jobs-feed.json" } }), /sandbox/i);
});

test("the fixture adapter cannot be pointed outside the repository", async () => {
  const adapter = createFixtureAdapter({ env: sandboxEnv });
  for (const file of ["../../etc/passwd", "/etc/passwd", "scripts/../../secret.json", "", 42]) {
    await assert.rejects(() => adapter.fetchPage({ config: { file } }), /file|path|repository/i, String(file));
  }
});

test("the fixture adapter paginates the shipped feed and normalizes what it returns", async () => {
  const adapter = createFixtureAdapter({ env: sandboxEnv });
  const first = await adapter.fetchPage({ config: { file: "scripts/fixtures/jobs-feed.json", pageSize: 3 } });
  assert.equal(first.items.length, 3);
  assert.equal(first.nextCursor, "3");
  const second = await adapter.fetchPage({ config: { file: "scripts/fixtures/jobs-feed.json", pageSize: 3 }, cursor: first.nextCursor });
  assert.equal(second.items.length, 3);

  const all = [...first.items, ...second.items];
  const results = all.map((item) => normalizeOpening(item, fieldMap));
  assert.ok(results.every((result) => result.ok), "the shipped fixture must normalize cleanly");
  // The fixture is explicit about being invented; nothing here may read as real.
  assert.ok(results.every((result) => /fiktif/i.test(result.opening.company)));
  assert.ok(results.every((result) => result.opening.applicationUrl.startsWith("https://example.invalid/")));
});

test("the fixture ships a deliberately invalid record so the rejection path stays visible", async () => {
  const adapter = createFixtureAdapter({ env: sandboxEnv });
  const page = await adapter.fetchPage({ config: { file: "scripts/fixtures/jobs-feed.json", pageSize: 50 } });
  const rejected = page.items.map((item) => normalizeOpening(item, fieldMap)).filter((result) => !result.ok);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].reason, /application URL/i);
});
