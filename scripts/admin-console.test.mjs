import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test, { afterEach } from "node:test";
import ts from "typescript";

// Same approach as scripts/admin-auth.test.mjs: run the real TypeScript modules
// and replace only the session, persistence and scheduler boundaries, so the
// authorization and routing decisions under test are the shipped ones.
const require = createRequire(import.meta.url);
const root = process.cwd();
const envKeys = ["ARENA_ADMIN_SUBJECTS", "ARENA_ADMIN_ROLES", "INTERNAL_ADMIN_TOKEN", "INTERNAL_ADMIN_SUBJECT", "INTERNAL_ADMIN_SCOPES", "INTERNAL_AUTOMATION_TOKEN"];
const saved = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const forbidden = error => error.code === "FORBIDDEN";

let session = null;
const calls = [];

function load(relative, mocks = {}) {
  const filename = path.resolve(root, relative);
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const resolve = specifier => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier === "server-only") return {};
    if (specifier === "@/server/auth/session") return { getCurrentUser: async () => session };
    if (specifier === "@/server/auth/origin") return { hasAllowedMutationOrigin: () => true };
    if (specifier === "@/server/arena") return load("src/server/arena/http.ts", mocks);
    if (specifier.startsWith("@/")) {
      const tsPath = `src/${specifier.slice(2)}.ts`;
      if (existsSync(path.resolve(root, tsPath))) return load(tsPath, mocks);
      const indexPath = `src/${specifier.slice(2)}/index.ts`;
      if (existsSync(path.resolve(root, indexPath))) return load(indexPath, mocks);
      return load(tsPath, mocks);
    }
    if (specifier.startsWith(".")) {
      const tsPath = path.resolve(path.dirname(filename), `${specifier}.ts`);
      if (existsSync(tsPath)) return load(tsPath, mocks);
      const indexPath = path.resolve(path.dirname(filename), specifier, "index.ts");
      if (existsSync(indexPath)) return load(indexPath, mocks);
      return load(tsPath, mocks);
    }
    return require(specifier);
  };
  new Function("require", "module", "exports", compiled)(resolve, module, module.exports);
  return module.exports;
}

function reset() {
  for (const key of envKeys) delete process.env[key];
  session = null;
  calls.length = 0;
}
afterEach(() => {
  reset();
  for (const key of envKeys) if (saved[key] !== undefined) process.env[key] = saved[key];
});

function post(body) {
  return new Request("https://arena.example.test/api/internal/admin/jobs", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
async function payload(response) {
  return { status: response.status, body: await response.json() };
}

// The scheduler is the only boundary these routes reach that would touch a
// database, so it is recorded rather than run.
const schedulerMock = {
  JOBS: Object.fromEntries(["week-close", "week-finalize", "email-flush", "week-notifications", "session-cleanup",
    "storage-cleanup", "project-drop", "project-generate", "reviews-run"]
    .map(job => [job, async () => { calls.push(job); return { job, done: true, detail: { skipped: "test" } }; }])),
};
const jobMocks = {
  "@/server/scheduler/service": schedulerMock,
  "@/server/reviews/audit": { writeAudit: async () => {} },
  "@/server/db/client": { getDb: () => ({}) },
  "@/server/db/schema": { runs: {} },
  "drizzle-orm": { desc: () => {} },
};

test("every scheduled job the timers can call is mapped to an admin scope", () => {
  const jobs = load("src/server/admin/jobs.ts", jobMocks);
  const auth = load("src/server/admin/auth.ts");
  const mapped = Object.keys(jobs.adminJobs).sort();
  assert.deepEqual(mapped, Object.keys(schedulerMock.JOBS).sort(), "a job without a console scope would reach the console ungated");
  for (const job of mapped) assert.ok(auth.arenaAdminScopes.includes(jobs.adminJobs[job].scope), `${job} maps to an unknown scope`);
});

test("running a job requires that job's own scope, and never the worker token", async () => {
  reset();
  process.env.INTERNAL_AUTOMATION_TOKEN = "worker-secret";
  const route = load("src/app/api/internal/admin/jobs/route.ts", jobMocks);

  // A reviews-only operator may drain reviews and nothing else.
  process.env.ARENA_ADMIN_ROLES = JSON.stringify({ "sk-participant:reviewer": ["reviews"] });
  session = { authSubject: "sk-participant:reviewer" };
  assert.equal((await payload(await route.POST(post({ job: "reviews-run" })))).status, 200);
  assert.deepEqual(calls, ["reviews-run"]);
  await assert.rejects(async () => {
    const response = await route.POST(post({ job: "project-generate" }));
    if (response.status !== 200) throw Object.assign(new Error("denied"), { code: "FORBIDDEN" });
  }, forbidden);
  assert.deepEqual(calls, ["reviews-run"], "a denied job must not have run");

  // An unknown name is authorised before it is rejected, so it cannot be probed.
  session = null;
  const anonymous = await payload(await route.POST(post({ job: "not-a-job" })));
  assert.equal(anonymous.status, 403);
  assert.equal(anonymous.body.error.code, "FORBIDDEN");
});

test("week actions split calendar scope from content scope", async () => {
  reset();
  const mocks = {
    "@/server/finalization/service": { closeWeekForFinalization: async () => ({}), finalizeWeek: async () => ({}) },
    "@/server/admin/content": {
      weekCreateSchema: { safeParse: () => ({ success: true, data: {} }) },
      weekRescheduleSchema: { safeParse: () => ({ success: true, data: {} }) },
      createAdminWeek: async () => { calls.push("create"); return {}; },
      rescheduleAdminWeek: async () => { calls.push("reschedule"); return {}; },
    },
    "@/server/generation/ai-provider": { createGenerationProvider: () => null },
    "@/server/generation/service": {
      generateWeek: async () => { calls.push("generate"); return { weekId: "w", results: [] }; },
      publishWeek: async () => { calls.push("publish"); return { weekId: "w", published: [], held: [] }; },
    },
  };
  const route = load("src/app/api/internal/weeks/[action]/route.ts", mocks);
  const uuid = "11111111-1111-4111-8111-111111111111";
  const call = (action, body) => route.POST(
    new Request("https://arena.example.test/api/internal/weeks/" + action, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action }) },
  );

  process.env.ARENA_ADMIN_ROLES = JSON.stringify({ "sk-participant:calendar": ["weeks"] });
  session = { authSubject: "sk-participant:calendar" };
  assert.equal((await call("create", {})).status, 200);
  // Generating and publishing content is not part of moving dates around.
  assert.equal((await call("generate", { weekId: uuid })).status, 403);
  assert.equal((await call("publish", { weekId: uuid })).status, 403);
  assert.deepEqual(calls, ["create"]);

  process.env.ARENA_ADMIN_ROLES = JSON.stringify({ "sk-participant:content": ["projects"] });
  session = { authSubject: "sk-participant:content" };
  assert.equal((await call("generate", { weekId: uuid })).status, 200);
  assert.equal((await call("publish", { weekId: uuid })).status, 200);
  assert.equal((await call("create", {})).status, 403);
  assert.deepEqual(calls, ["create", "generate", "publish"]);
});

test("admin date inputs are read as Jakarta wall clock regardless of the browser zone", () => {
  const { fromJakartaInput, toJakartaInput } = load("src/lib/jakarta-time.ts");
  // A Tuesday 08:00 launch typed by an operator is 01:00 UTC, not 08:00 UTC.
  assert.equal(fromJakartaInput("2026-09-08T08:00"), "2026-09-08T01:00:00.000Z");
  assert.equal(fromJakartaInput("2026-09-08T08:00:30"), "2026-09-08T01:00:30.000Z");
  assert.equal(fromJakartaInput("nonsense"), null);
  assert.equal(fromJakartaInput(""), null);
  // Round-tripping a stored instant returns the same wall clock it was typed as.
  assert.equal(toJakartaInput("2026-09-08T01:00:00.000Z"), "2026-09-08T08:00");
  assert.equal(toJakartaInput(null), "");
});

// The launch orchestration composes four existing operations; what matters is
// the order, and that a failed step stops the ones that depend on it.
function launchMocks(overrides = {}) {
  return {
    "@/server/db/client": { getDb: () => ({}) },
    "@/server/db/schema": { projects: { weekId: {}, status: {}, previewStatus: {}, createdAt: {}, id: {}, title: {} }, weeks: {} },
    "drizzle-orm": { and: () => {}, asc: () => {}, eq: () => {}, ne: () => {} },
    "@/server/reviews/audit": { writeAudit: async () => {} },
    "@/server/generation/ai-provider": { createGenerationProvider: () => null },
    // launch.ts reaches content.ts by relative path, so the key must match the
    // specifier as written rather than its alias form.
    "./content": {
      createAdminWeek: async ({ weekCode }) => { calls.push("create-week"); return { id: "week-1", weekCode, status: "DRAFT", opensAt: new Date() }; },
    },
    "@/server/generation/service": {
      generateWeek: async () => { calls.push("generate"); return { weekId: "week-1", results: [{ divisionId: "d1", projectId: "p1" }] }; },
      reviewProject: async () => { calls.push("approve"); return {}; },
      publishWeek: async () => { calls.push("publish"); return { weekId: "week-1", published: ["p1"], held: [] }; },
      ...overrides.generation,
    },
  };
}

test("an off-schedule release runs create, generate, approve and publish in order", async () => {
  reset();
  const mocks = launchMocks();
  // The approve step reads pending projects straight from the database.
  mocks["@/server/db/client"] = { getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [{ id: "p1", title: "Project" }] }) }) }),
  }) };
  const { launchProjectRun } = load("src/server/admin/launch.ts", mocks);
  const result = await launchProjectRun({
    opensAt: "2026-09-08T01:00:00.000Z", submissionDeadlineAt: "2026-09-12T16:59:00.000Z",
    approve: true, publish: true, reason: "urgent", actorSubject: "sk-participant:admin",
  });
  assert.deepEqual(calls, ["create-week", "generate", "approve", "publish"]);
  assert.deepEqual(result.steps.map(s => `${s.step}:${s.ok}`), ["week:true", "generate:true", "approve:true", "publish:true"]);
  assert.equal(result.created, true);
});

test("generation failing outright stops the release before it approves or publishes", async () => {
  reset();
  // Both modules must share one ArenaDomainError class, or the `instanceof`
  // guard inside launch.ts would treat a domain error as a programming fault
  // and rethrow it.
  const errors = load("src/server/arena/errors.ts");
  const mocks = launchMocks({
    generation: {
      generateWeek: async () => {
        calls.push("generate");
        throw new errors.ArenaDomainError("WEEK_NOT_READY", "Register a validated library template first.");
      },
    },
  });
  mocks["@/server/arena/errors"] = errors;
  const { launchProjectRun } = load("src/server/admin/launch.ts", mocks);
  const result = await launchProjectRun({
    opensAt: "2026-09-08T01:00:00.000Z", submissionDeadlineAt: "2026-09-12T16:59:00.000Z",
    approve: true, publish: true, reason: "urgent", actorSubject: "sk-participant:admin",
  });
  assert.deepEqual(calls, ["create-week", "generate"], "nothing may be approved or published once generation failed");
  assert.deepEqual(result.steps.map(s => `${s.step}:${s.ok}`), ["week:true", "generate:false"]);
  assert.equal(result.steps.at(-1).detail.failed, "WEEK_NOT_READY");
});

test("the release endpoint answers to the n8n admin token, never the worker token", async () => {
  reset();
  const route = load("src/app/api/internal/admin/launch/route.ts", {
    "@/server/admin/launch": {
      launchSchema: { safeParse: () => ({ success: true, data: { approve: false, publish: false, reason: "n8n" } }) },
      launchProjectRun: async ({ actorSubject }) => { calls.push(actorSubject); return { weekId: "w", weekCode: "ADHOC", created: true, steps: [] }; },
    },
  });
  const call = token => route.POST(new Request("https://arena.example.test/api/internal/admin/launch", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ reason: "n8n" }),
  }));

  process.env.INTERNAL_AUTOMATION_TOKEN = "worker-secret";
  process.env.INTERNAL_ADMIN_TOKEN = "admin-secret";
  process.env.INTERNAL_ADMIN_SUBJECT = "service:n8n";
  process.env.INTERNAL_ADMIN_SCOPES = "projects";
  assert.equal((await call("worker-secret")).status, 403, "the shared worker token must never release a week");
  assert.equal((await call("admin-secret")).status, 200);
  assert.deepEqual(calls, ["service:n8n"], "the audit actor comes from configuration, never the payload");

  // A token scoped to something else cannot release content either.
  process.env.INTERNAL_ADMIN_SCOPES = "weeks";
  assert.equal((await call("admin-secret")).status, 403);
});

test("the audit log is read-only, keyset-paged, and filterable", async () => {
  reset();
  // Capture the query the module builds without a live database.
  const captured = {};
  const chain = {
    from: () => chain, where: (w) => { captured.where = w; return chain; },
    orderBy: () => chain, limit: (n) => { captured.limit = n; return Promise.resolve(captured.rows ?? []); },
    selectDistinct: () => chain,
  };
  const db = { select: () => chain, selectDistinct: () => chain };
  const mocks = {
    "@/server/db/client": { getDb: () => db },
    "@/server/db/schema": { logs: { id: "id", createdAt: "createdAt", actorType: "actorType", actorSubject: "actorSubject", action: "action", entityType: "entityType", entityId: "entityId", metadata: "metadata" } },
    "drizzle-orm": { and: (...a) => ({ and: a.filter(Boolean) }), desc: (c) => ({ desc: c }), eq: (c, v) => ({ eq: [c, v] }), ilike: (c, v) => ({ ilike: [c, v] }), lt: (c, v) => ({ lt: [c, v] }), or: (...a) => ({ or: a }) },
  };
  const audit = load("src/server/admin/audit.ts", mocks);

  // Fetches limit+1 to know whether another page exists, and returns only limit.
  captured.rows = Array.from({ length: 51 }, (_, i) => ({ id: `id-${i}`, createdAt: new Date(2026, 0, 1, 0, 0, i) }));
  const page = await audit.listAuditLog({ q: "", limit: 50 });
  assert.equal(captured.limit, 51, "must over-fetch by one to detect a next page");
  assert.equal(page.entries.length, 50);
  assert.equal(page.nextBefore, page.entries[49].createdAt.toISOString(), "nextBefore is the last row's timestamp, for keyset paging");

  // A short page has no next cursor.
  captured.rows = [{ id: "only", createdAt: new Date(2026, 0, 1) }];
  assert.equal((await audit.listAuditLog({ q: "", limit: 50 })).nextBefore, null);

  // The module exposes no writer at all — an editable audit trail is not one.
  assert.equal(typeof audit.listAuditLog, "function");
  assert.ok(!("writeAuditLog" in audit) && !("deleteAuditLog" in audit) && !("updateAuditLog" in audit));
});

test("reading the audit log requires only the overview scope, and offers no write verb", async () => {
  reset();
  const route = load("src/app/api/internal/admin/audit/route.ts", {
    "@/server/admin/audit": {
      auditQuery: { safeParse: () => ({ success: true, data: { q: "", limit: 50 } }) },
      listAuditLog: async () => ({ entries: [], nextBefore: null }),
      auditEntityTypes: async () => ["week", "project"],
    },
  });
  assert.equal(typeof route.GET, "function");
  assert.equal(route.POST, undefined, "the audit endpoint must not expose a mutation");
  assert.equal(route.DELETE, undefined);

  const get = (subject) => {
    session = subject ? { authSubject: subject } : null;
    return route.GET(new Request("https://arena.example.test/api/internal/admin/audit"));
  };
  process.env.ARENA_ADMIN_ROLES = JSON.stringify({ "sk-participant:viewer": ["overview"], "sk-participant:rewards-only": ["rewards"] });
  assert.equal((await get("sk-participant:viewer")).status, 200);
  // A scope that is not overview cannot read the trail...
  assert.equal((await get("sk-participant:rewards-only")).status, 403);
  // ...and neither can an anonymous caller.
  assert.equal((await get(null)).status, 403);
});
