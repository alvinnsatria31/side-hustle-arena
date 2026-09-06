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
