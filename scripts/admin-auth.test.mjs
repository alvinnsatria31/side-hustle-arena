import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test, { afterEach } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
let session = null;
let allowedOrigin = true;
const calls = [];
const root = process.cwd();
const envKeys = ["ARENA_ADMIN_SUBJECTS", "ARENA_ADMIN_ROLES", "INTERNAL_ADMIN_TOKEN", "INTERNAL_ADMIN_SUBJECT", "INTERNAL_ADMIN_SCOPES", "INTERNAL_AUTOMATION_TOKEN"];
const saved = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const forbidden = error => error.code === "FORBIDDEN";

// Run the real TS modules, replacing only session/config and persistence boundaries.
function load(relative, mocks = {}) {
  const filename = path.resolve(root, relative);
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const resolve = specifier => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier === "server-only") return {};
    if (specifier === "@/server/auth/session") return { getCurrentUser: async () => session };
    if (specifier === "@/server/auth/origin") return { hasAllowedMutationOrigin: () => allowedOrigin };
    if (specifier === "@/server/arena") return load("src/server/arena/http.ts", mocks);
    if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}.ts`, mocks);
    if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`), mocks);
    return require(specifier);
  };
  new Function("require", "module", "exports", compiled)(resolve, module, module.exports);
  return module.exports;
}
function reset() {
  for (const key of envKeys) delete process.env[key];
  session = null;
  allowedOrigin = true;
  calls.length = 0;
}
afterEach(() => {
  reset();
  for (const key of envKeys) if (saved[key] !== undefined) process.env[key] = saved[key];
});
function request(token, method = "GET", body) {
  return new Request("https://arena.example.test/api/internal/admin/flags", {
    method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function auth() {
  assert.ok(existsSync(path.join(root, "src/server/admin/auth.ts")), "scoped admin guard must exist");
  return load("src/server/admin/auth.ts");
}

test("A07: automation credentials never grant any admin scope", async () => {
  reset();
  process.env.INTERNAL_AUTOMATION_TOKEN = "worker-secret";
  const api = auth();
  for (const scope of api.arenaAdminScopes) await assert.rejects(api.requireArenaAdmin(request("worker-secret"), scope), forbidden);
  process.env.INTERNAL_ADMIN_TOKEN = "worker-secret";
  process.env.INTERNAL_ADMIN_SUBJECT = "service:ops";
  process.env.INTERNAL_ADMIN_SCOPES = "overview,reviews,weeks,projects,rewards,users,storage";
  await assert.rejects(api.requireArenaAdmin(request("worker-secret"), "overview"), forbidden);
});

test("session allowlist matches canonical subject exactly and grants all scopes", async () => {
  reset();
  process.env.ARENA_ADMIN_SUBJECTS = "sk-participant:admin, sk-participant:other";
  session = { authSubject: "sk-participant:admin" };
  const api = auth();
  for (const scope of api.arenaAdminScopes) assert.deepEqual(await api.requireArenaAdmin(request(), scope), { actorSubject: session.authSubject });
  session = { authSubject: "admin", email: "sk-participant:admin" };
  await assert.rejects(api.requireArenaAdmin(request(), "overview"), forbidden);
});

test("roles enforce scope isolation and malformed config fails closed", async () => {
  reset();
  process.env.ARENA_ADMIN_ROLES = JSON.stringify({ "sk-participant:reviewer": ["reviews"] });
  session = { authSubject: "sk-participant:reviewer" };
  const api = auth();
  assert.equal((await api.requireArenaAdmin(request(), "reviews")).actorSubject, session.authSubject);
  await assert.rejects(api.requireArenaAdmin(request(), "users"), forbidden);
  for (const invalid of ["{", "[]", '{"sk-participant:reviewer":["typo"]}', '{"sk-participant:reviewer":"reviews"}']) {
    process.env.ARENA_ADMIN_ROLES = invalid;
    await assert.rejects(api.requireArenaAdmin(request(), "reviews"), forbidden);
  }
});

test("service token requires distinct credential, configured actor, and explicit scope", async () => {
  reset();
  const api = auth();
  process.env.INTERNAL_ADMIN_TOKEN = "admin-secret";
  await assert.rejects(api.requireArenaAdmin(request("admin-secret"), "reviews"), forbidden);
  process.env.INTERNAL_ADMIN_SUBJECT = "service:ops";
  await assert.rejects(api.requireArenaAdmin(request("admin-secret"), "reviews"), forbidden);
  process.env.INTERNAL_ADMIN_SCOPES = "reviews";
  assert.deepEqual(await api.requireArenaAdmin(request("admin-secret"), "reviews"), { actorSubject: "service:ops" });
  await assert.rejects(api.requireArenaAdmin(request("admin-secret"), "users"), forbidden);
  await assert.rejects(api.requireArenaAdmin(request("wrong"), "reviews"), forbidden);
});

test("session mutations require existing origin check; bad bearer never falls back to session", async () => {
  reset();
  session = { authSubject: "sk-participant:admin" };
  process.env.ARENA_ADMIN_SUBJECTS = session.authSubject;
  const api = auth();
  allowedOrigin = false;
  await assert.rejects(api.requireArenaAdmin(request(undefined, "POST", {}), "reviews"), forbidden);
  assert.equal((await api.requireArenaAdmin(request(), "reviews")).actorSubject, session.authSubject);
  allowedOrigin = true;
  assert.equal((await api.requireArenaAdmin(request(undefined, "POST", {}), "reviews")).actorSubject, session.authSubject);
  await assert.rejects(api.requireArenaAdmin(request("wrong"), "reviews"), forbidden);
});

test("admin mutation routes derive auditable actor from guard, never request body", async () => {
  reset();
  process.env.INTERNAL_ADMIN_TOKEN = "admin-secret";
  process.env.INTERNAL_ADMIN_SUBJECT = "service:verified";
  process.env.INTERNAL_ADMIN_SCOPES = "reviews,weeks,users,rewards,projects";
  const capture = async input => { calls.push(input); return { ok: true }; };
  const mocks = {
    "@/server/admin/overview": { setArenaFeatureFlag: capture },
    "@/server/reviews/admin": { rerunReview: capture, overrideReview: capture },
    "@/server/finalization/service": { closeWeekForFinalization: capture, finalizeWeek: capture, voidEnrollment: capture },
  };
  const uuid = "11111111-1111-4111-8111-111111111111";
  const cases = [
    ["admin/flags", {}, { key: "arena-enrollment", closed: true }],
    ["reviews/admin/[action]", { action: "rerun" }, { versionId: uuid, reason: "recheck" }],
    ["reviews/admin/[action]", { action: "override" }, { reviewId: uuid, newScore: 75, reason: "verified" }],
    ["weeks/[action]", { action: "close" }, { weekId: uuid }],
    ["weeks/[action]", { action: "finalize" }, { weekId: uuid }],
    ["enrollments/[id]/void", { id: uuid }, { reason: "fraud" }],
  ];
  for (const [route, params, body] of cases) {
    const response = await load(`src/app/api/internal/${route}/route.ts`, mocks).POST(request("admin-secret", "POST", { ...body, actorSubject: "forged-client" }), { params: Promise.resolve(params) });
    assert.equal(response.status, 200, `${route}: ${await response.text()}`);
    assert.equal(calls.at(-1).actorSubject, "service:verified");
  }
});
