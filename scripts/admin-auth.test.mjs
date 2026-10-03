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
const envKeys = ["ARENA_ADMIN_SUBJECTS", "ARENA_ADMIN_ROLES", "INTERNAL_ADMIN_TOKEN", "INTERNAL_ADMIN_SUBJECT", "INTERNAL_ADMIN_SCOPES", "INTERNAL_AUTOMATION_TOKEN", "CENTRAL_ADMIN_TOKEN", "CENTRAL_ADMIN_SUBJECT", "CENTRAL_ADMIN_SCOPES"];
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

test("nav flag reads the same allowlist and hides the console on bad config", async () => {
  reset();
  const api = auth();
  assert.deepEqual(api.arenaAdminScopesFor("sk-participant:admin"), []);
  process.env.ARENA_ADMIN_SUBJECTS = "sk-participant:admin";
  assert.deepEqual(api.arenaAdminScopesFor("sk-participant:admin"), [...api.arenaAdminScopes]);
  assert.deepEqual(api.arenaAdminScopesFor("sk-participant:someone-else"), []);
  process.env.ARENA_ADMIN_ROLES = JSON.stringify({ "sk-participant:reviewer": ["reviews"] });
  assert.deepEqual(api.arenaAdminScopesFor("sk-participant:reviewer"), ["reviews"]);
  // Signed-in pages render this on every request, so a broken roles map must
  // drop the entrance rather than throw the whole navbar away.
  process.env.ARENA_ADMIN_ROLES = "{";
  assert.deepEqual(api.arenaAdminScopesFor("sk-participant:reviewer"), []);
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

test("the central admin has its own bearer, subject and scopes; neither credential widens the other", async () => {
  reset();
  const api = auth();
  const central = "central-admin-bearer-0123456789abcdef";
  // n8n's ad-hoc launch already holds INTERNAL_ADMIN_TOKEN with `projects`
  // only. The unified admin needs far more, and must not get it by widening
  // the token a workflow box carries.
  process.env.INTERNAL_ADMIN_TOKEN = "admin-secret";
  process.env.INTERNAL_ADMIN_SUBJECT = "service:n8n-adhoc";
  process.env.INTERNAL_ADMIN_SCOPES = "projects";
  process.env.CENTRAL_ADMIN_TOKEN = central;
  process.env.CENTRAL_ADMIN_SUBJECT = " central-admin:website ";
  process.env.CENTRAL_ADMIN_SCOPES = "overview, store users";

  assert.deepEqual(await api.requireArenaAdmin(request(central), "store"), { actorSubject: "central-admin:website" });
  assert.deepEqual(await api.requireArenaAdmin(request(central), "users"), { actorSubject: "central-admin:website" });
  assert.deepEqual(await api.requireArenaAdmin(request("admin-secret"), "projects"), { actorSubject: "service:n8n-adhoc" });
  await assert.rejects(api.requireArenaAdmin(request(central), "projects"), forbidden, "the central scopes are its own, not a union");
  await assert.rejects(api.requireArenaAdmin(request("admin-secret"), "store"), forbidden, "the workflow token gains nothing");
  await assert.rejects(api.requireArenaAdmin(request(`${central}x`), "store"), forbidden);
  await assert.rejects(api.requireArenaAdmin(request(central.slice(0, -1)), "store"), forbidden);

  // A typo in the scope list grants nothing rather than whatever parsed.
  process.env.CENTRAL_ADMIN_SCOPES = "overview,store,everything";
  await assert.rejects(api.requireArenaAdmin(request(central), "store"), forbidden);
});

test("a central admin credential that is not a real, separate secret is absent", async () => {
  reset();
  const api = auth();
  const central = "central-admin-bearer-0123456789abcdef";
  const configure = (values) => {
    for (const key of envKeys) delete process.env[key];
    Object.assign(process.env, { CENTRAL_ADMIN_TOKEN: central, CENTRAL_ADMIN_SUBJECT: "central-admin:website", CENTRAL_ADMIN_SCOPES: "overview,store", ...values });
    for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key];
  };

  configure({});
  assert.deepEqual(await api.requireArenaAdmin(request(central), "overview"), { actorSubject: "central-admin:website" });

  // No subject: the audit trail would have nobody to name.
  configure({ CENTRAL_ADMIN_SUBJECT: undefined });
  await assert.rejects(api.requireArenaAdmin(request(central), "overview"), forbidden);
  configure({ CENTRAL_ADMIN_SUBJECT: "   " });
  await assert.rejects(api.requireArenaAdmin(request(central), "overview"), forbidden);

  // No scopes: configured but powerless, never "all".
  configure({ CENTRAL_ADMIN_SCOPES: undefined });
  for (const scope of api.arenaAdminScopes) await assert.rejects(api.requireArenaAdmin(request(central), scope), forbidden);

  // Too short to be a secret.
  configure({ CENTRAL_ADMIN_TOKEN: "short-token" });
  await assert.rejects(api.requireArenaAdmin(request("short-token"), "overview"), forbidden);

  // The worker's token must never carry admin rights under another name.
  configure({ INTERNAL_AUTOMATION_TOKEN: central });
  for (const scope of api.arenaAdminScopes) await assert.rejects(api.requireArenaAdmin(request(central), scope), forbidden);

  // Reusing the workflow token defeats the separation: the copy is ignored and
  // the token keeps exactly the narrow rights it already had.
  configure({ INTERNAL_ADMIN_TOKEN: central, INTERNAL_ADMIN_SUBJECT: "service:n8n-adhoc", INTERNAL_ADMIN_SCOPES: "projects" });
  assert.deepEqual(await api.requireArenaAdmin(request(central), "projects"), { actorSubject: "service:n8n-adhoc" });
  await assert.rejects(api.requireArenaAdmin(request(central), "store"), forbidden);

  // Unset entirely: nothing about the existing bearer path changes.
  configure({ CENTRAL_ADMIN_TOKEN: undefined, INTERNAL_ADMIN_TOKEN: "admin-secret", INTERNAL_ADMIN_SUBJECT: "service:ops", INTERNAL_ADMIN_SCOPES: "reviews" });
  assert.deepEqual(await api.requireArenaAdmin(request("admin-secret"), "reviews"), { actorSubject: "service:ops" });
  await assert.rejects(api.requireArenaAdmin(request(central), "overview"), forbidden);
});

test("a central bearer never falls back to a signed-in admin session", async () => {
  reset();
  session = { authSubject: "sk-participant:admin" };
  process.env.ARENA_ADMIN_SUBJECTS = session.authSubject;
  process.env.CENTRAL_ADMIN_TOKEN = "central-admin-bearer-0123456789abcdef";
  process.env.CENTRAL_ADMIN_SUBJECT = "central-admin:website";
  process.env.CENTRAL_ADMIN_SCOPES = "overview";
  const api = auth();
  await assert.rejects(api.requireArenaAdmin(request("central-admin-bearer-0123456789abcdeX"), "overview"), forbidden);
  await assert.rejects(api.requireArenaAdmin(request("central-admin-bearer-0123456789abcdef"), "users"), forbidden, "the session's wider scopes are not borrowed");
  const malformed = new Request("https://arena.example.test/api/internal/admin/overview", { headers: { authorization: "Basic abc" } });
  await assert.rejects(api.requireArenaAdmin(malformed, "overview"), forbidden);
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
    "@/server/admin/content": {
      weekCreateSchema: { safeParse: () => ({ success: true, data: {} }) },
      weekRescheduleSchema: { safeParse: () => ({ success: true, data: {} }) },
      createAdminWeek: capture,
      rescheduleAdminWeek: capture,
    },
    "@/server/generation/ai-provider": { createGenerationProvider: () => null },
    "@/server/generation/service": { generateWeek: capture, publishWeek: capture },
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
