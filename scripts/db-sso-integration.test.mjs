import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const arenaOrigin = process.env.ARENA_ORIGIN;
const canonicalOrigin = process.env.SK_AUTH_ORIGIN;
const clientSecret = process.env.ARENA_SSO_CLIENT_SECRET;
const email = process.env.ARENA_INTEGRATION_TEST_EMAIL;
const password = process.env.ARENA_INTEGRATION_TEST_PASSWORD;
const execFileAsync = promisify(execFile);
const outageTest = process.env.RUN_CANONICAL_OUTAGE_TEST === "1" ? test : test.skip;

function requireLocalIntegrationConfig() {
  assert.equal(process.env.APP_ENV, "development", "local SSO integration tests require APP_ENV=development");
  assert.equal(arenaOrigin, "http://localhost:3001", "local SSO integration tests require Arena on localhost:3001");
  assert.equal(canonicalOrigin, "http://localhost:3000", "local SSO integration tests require Canonical on localhost:3000");
  assert.ok(clientSecret && clientSecret.length >= 32, "ARENA_SSO_CLIENT_SECRET must be configured locally");
  assert.ok(email && password, "local integration fixture credentials must be configured");
}

function applySetCookies(response, jar) {
  for (const header of response.headers.getSetCookie()) {
    const first = header.split(";", 1)[0];
    const index = first.indexOf("=");
    if (index < 1) continue;
    const name = first.slice(0, index);
    const value = first.slice(index + 1);
    if (/max-age=0/i.test(header) || /expires=Thu, 01 Jan 1970/i.test(header)) jar.delete(name);
    else jar.set(name, value);
  }
}

async function request(url, jar, init = {}) {
  const headers = new Headers(init.headers);
  if (jar.size) headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
  const response = await fetch(url, { ...init, headers, redirect: "manual" });
  applySetCookies(response, jar);
  return response;
}

function redirectLocation(response, base) {
  const location = response.headers.get("location");
  assert.ok(location, "expected redirect location");
  return new URL(location, base).toString();
}

async function canonicalLogin(returnTo) {
  const jar = new Map();
  const flow = await request(`${canonicalOrigin}/api/auth/login-flow?returnTo=${encodeURIComponent(returnTo)}`, jar, {
    headers: { origin: canonicalOrigin },
  });
  assert.equal(flow.status, 200, "login flow should start");
  const { csrfToken } = await flow.json();
  assert.ok(csrfToken, "login flow should issue a CSRF token");

  const login = await request(`${canonicalOrigin}/api/auth/login`, jar, {
    method: "POST",
    headers: { origin: canonicalOrigin, "content-type": "application/json", "x-skw-login-csrf": csrfToken },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, "fixture user should log in");
  const body = await login.json();
  assert.equal(body.ok, true, "fixture login should succeed");
  assert.equal(typeof body.redirectTo, "string", "fixture login should preserve its continuation");
  assert.ok(jar.has("skw_session"), "canonical session should remain in the canonical cookie jar");
  return { jar, redirectTo: body.redirectTo };
}

async function createArenaSession(returnTo = "/app") {
  const jar = new Map();
  const start = await request(`${arenaOrigin}/auth/login?returnTo=${encodeURIComponent(returnTo)}`, jar);
  assert.ok(start.status >= 300 && start.status < 400, "Arena login should redirect to Canonical");
  const authorizeUrl = redirectLocation(start, arenaOrigin);

  const unauthenticatedAuthorize = await request(authorizeUrl, jar);
  assert.ok(unauthenticatedAuthorize.status >= 300 && unauthenticatedAuthorize.status < 400, "Canonical authorize should request login when unauthenticated");
  const loginUrl = new URL(redirectLocation(unauthenticatedAuthorize, canonicalOrigin));
  const continuation = loginUrl.searchParams.get("returnTo");
  assert.ok(continuation, "Canonical authorize should preserve its exact return path");

  const login = await canonicalLogin(continuation);
  for (const entry of login.jar) jar.set(...entry);
  const authorized = await request(new URL(login.redirectTo, canonicalOrigin).toString(), jar);
  assert.ok(authorized.status >= 300 && authorized.status < 400, "Canonical authorize should return an authorization code after login");

  const callback = await request(redirectLocation(authorized, canonicalOrigin), jar);
  assert.ok(callback.status >= 300 && callback.status < 400, "Arena callback should establish a local session");
  const finalLocation = new URL(redirectLocation(callback, arenaOrigin));
  assert.equal(finalLocation.origin, arenaOrigin, "Arena callback must not redirect off-origin");
  assert.equal(finalLocation.pathname, returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/app");
  assert.ok(jar.has("arena_session"), "Arena callback should issue a local session cookie");

  const app = await request(`${arenaOrigin}/app`, jar);
  assert.equal(app.status, 200, "protected Arena app should accept the new local session");
  return jar;
}

function arenaDatabase() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured for the Arena integration test");
  return postgres(process.env.DATABASE_URL, { max: 1 });
}

async function getArenaSession(jar) {
  const rawToken = jar.get("arena_session");
  assert.ok(rawToken, "expected Arena session cookie");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const sql = arenaDatabase();
  try {
    const rows = await sql`
      select sessions.id, sessions.token_hash, sessions.canonical_grant_id, sessions.expires_at, users.auth_subject
      from identity.sessions sessions
      join identity.users users on users.id = sessions.user_id
      where sessions.token_hash = ${tokenHash}
    `;
    assert.equal(rows.length, 1, "Arena must store exactly one hash-addressable local session");
    assert.equal(rows[0].token_hash, tokenHash, "Arena must address local sessions by a hash");
    assert.notEqual(rows[0].token_hash, rawToken, "raw Arena session token must never be stored");
    return rows[0];
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function introspect(grantId, secret = clientSecret) {
  const response = await fetch(`${canonicalOrigin}/api/sso/arena/introspect`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ grantId }),
  });
  return { status: response.status, body: await response.json() };
}

async function canonicalSql(statement) {
  const { stdout } = await execFileAsync("docker", ["exec", "skw-postgres", "psql", "-U", "postgres", "-d", "sekolah_karir", "-v", "ON_ERROR_STOP=1", "-qAtc", statement]);
  return stdout.trim();
}

async function issueAuthorizationCode() {
  const verifier = randomBytes(32).toString("base64url");
  const redirectUri = `${arenaOrigin}/auth/callback`;
  const parameters = new URLSearchParams({
    client_id: "arena",
    redirect_uri: redirectUri,
    state: randomBytes(32).toString("base64url"),
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  const login = await canonicalLogin(`/api/sso/arena/authorize?${parameters}`);
  const authorized = await request(new URL(login.redirectTo, canonicalOrigin).toString(), login.jar);
  assert.ok(authorized.status >= 300 && authorized.status < 400, "Canonical authorize should issue a code to its exact callback URI");
  const callback = new URL(redirectLocation(authorized, canonicalOrigin));
  const code = callback.searchParams.get("code");
  assert.ok(code, "Canonical authorize should return a code");
  assert.equal(callback.origin, arenaOrigin);
  assert.equal(callback.pathname, "/auth/callback");
  return { code, verifier, redirectUri, jar: login.jar };
}

async function exchangeCode({ code, verifier, redirectUri }) {
  const response = await fetch(`${canonicalOrigin}/api/sso/arena/token`, {
    method: "POST",
    headers: { authorization: `Bearer ${clientSecret}`, "content-type": "application/json" },
    body: JSON.stringify({ clientId: "arena", code, codeVerifier: verifier, redirectUri }),
  });
  return { status: response.status, body: await response.json() };
}

async function logoutCanonicalJar(jar) {
  const response = await request(`${canonicalOrigin}/api/auth/logout`, jar, { method: "POST", headers: { origin: canonicalOrigin } });
  assert.equal(response.status, 200, "test fixture canonical session should be cleaned up");
}

async function stopCanonicalDevServer() {
  await execFileAsync("powershell.exe", ["-NoProfile", "-Command", "$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop | Select-Object -First 1; $child = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess); $parent = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $child.ParentProcessId); if ($child.Name -ne 'node.exe' -or $child.CommandLine -notmatch 'Sekolah Karir Workspace' -or $child.CommandLine -notmatch 'next' -or $parent.Name -ne 'node.exe' -or $parent.CommandLine -notmatch 'Sekolah Karir Workspace' -or $parent.CommandLine -notmatch 'next') { exit 2 }; taskkill /PID $parent.ProcessId /T /F *> $null"]);
}

function readCanonicalLocalSsoConfig() {
  const values = Object.fromEntries(readFileSync(join("D:\\Sekolah Karir Workspace", ".env.local"), "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      return match ? [[match[1], match[2]]] : [];
    }));
  for (const key of ["APP_URL", "ARENA_SSO_CLIENT_ID", "ARENA_SSO_CLIENT_SECRET", "ARENA_SSO_ALLOWED_REDIRECT_URIS"]) {
    assert.ok(values[key], `Canonical local ${key} must be configured for the outage test`);
  }
  return values;
}

async function startCanonicalDevServer() {
  const canonicalConfig = readCanonicalLocalSsoConfig();
  const child = spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd run dev -- -p 3000"], {
    cwd: "D:\\Sekolah Karir Workspace",
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "development",
      APP_URL: canonicalConfig.APP_URL,
      ARENA_SSO_CLIENT_ID: canonicalConfig.ARENA_SSO_CLIENT_ID,
      ARENA_SSO_CLIENT_SECRET: canonicalConfig.ARENA_SSO_CLIENT_SECRET,
      ARENA_SSO_ALLOWED_REDIRECT_URIS: canonicalConfig.ARENA_SSO_ALLOWED_REDIRECT_URIS,
    },
  });
  child.unref();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const response = await fetch(`${canonicalOrigin}/login`, { signal: AbortSignal.timeout(3_000) });
      if (response.status === 200) return;
    } catch {
      // The development server is expected to be unavailable while it restarts.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  assert.fail("Canonical development server did not restart on localhost:3000");
}

test("DB-backed local SSO provisions one Arena identity and stores only a session hash", async () => {
  requireLocalIntegrationConfig();
  const jar = await createArenaSession();
  const session = await getArenaSession(jar);
  const live = await introspect(session.canonical_grant_id);
  assert.equal(live.status, 200);
  assert.equal(live.body.active, true, "new canonical grant should introspect as active");
  assert.equal(live.body.subject, session.auth_subject, "introspection subject must match the JIT identity subject");
  assert.ok(new Date(session.expires_at) <= new Date(live.body.expiresAt), "Arena session must not outlive its canonical grant");

  const sql = arenaDatabase();
  try {
    const users = await sql`select count(*)::int as count from identity.users where auth_subject = ${session.auth_subject}`;
    assert.equal(users[0].count, 1, "JIT provisioning must remain unique by canonical subject");
  } finally {
    await sql.end({ timeout: 5 });
  }
});

test("Arena logout revokes its local session and the canonical grant", async () => {
  requireLocalIntegrationConfig();
  const jar = await createArenaSession();
  const session = await getArenaSession(jar);
  const logout = await request(`${arenaOrigin}/auth/logout`, jar, { method: "POST", headers: { origin: arenaOrigin } });
  assert.equal(logout.status, 303, "Arena logout should redirect after local cleanup");
  assert.equal(jar.has("arena_session"), false, "Arena logout must clear the browser session cookie");

  const revoked = await introspect(session.canonical_grant_id);
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.active, false, "Arena logout should revoke its canonical grant");
});

test("canonical logout propagation fails closed when Arena revalidation is due", async () => {
  requireLocalIntegrationConfig();
  const jar = await createArenaSession();
  const session = await getArenaSession(jar);
  const logout = await request(`${canonicalOrigin}/api/auth/logout`, jar, { method: "POST", headers: { origin: canonicalOrigin } });
  assert.equal(logout.status, 200, "Canonical logout should succeed for the authenticated fixture session");
  const revoked = await introspect(session.canonical_grant_id);
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.active, false, "Canonical logout must revoke grants sourced from the closed session");

  const sql = arenaDatabase();
  try {
    const updated = await sql`update identity.sessions set last_canonical_check_at = now() - interval '6 minutes' where id = ${session.id} returning id`;
    assert.equal(updated.length, 1, "test must make the Arena revalidation due");
  } finally {
    await sql.end({ timeout: 5 });
  }
  const app = await request(`${arenaOrigin}/app`, jar);
  const verification = arenaDatabase();
  try {
    const rows = await verification`select revoked_at from identity.sessions where id = ${session.id}`;
    assert.ok(rows[0].revoked_at, "failed canonical revalidation must revoke the Arena session");
  } finally {
    await verification.end({ timeout: 5 });
  }
  assert.ok(app.status >= 300 && app.status < 400, "Arena must reject a locally cached session after its revoked grant is revalidated");
  const location = new URL(redirectLocation(app, arenaOrigin));
  assert.equal(location.pathname, "/auth/login");
});

test("introspection rejects incorrect client authentication", async () => {
  requireLocalIntegrationConfig();
  const response = await introspect("00000000-0000-0000-0000-000000000000", "invalid-local-client-secret");
  assert.equal(response.status, 401);
});

test("Arena callback rejects missing and mismatched authorization state", async () => {
  requireLocalIntegrationConfig();
  const code = randomBytes(32).toString("base64url");
  const missingState = await request(`${arenaOrigin}/auth/callback?code=${encodeURIComponent(code)}`, new Map());
  assert.ok(missingState.status >= 300 && missingState.status < 400);
  assert.equal(new URL(redirectLocation(missingState, arenaOrigin)).pathname, "/login");

  const jar = new Map();
  const start = await request(`${arenaOrigin}/auth/login?returnTo=%2Fapp`, jar);
  assert.ok(start.status >= 300 && start.status < 400);
  const wrongState = await request(`${arenaOrigin}/auth/callback?code=${encodeURIComponent(code)}&state=wrong-state`, jar);
  assert.ok(wrongState.status >= 300 && wrongState.status < 400);
  assert.equal(new URL(redirectLocation(wrongState, arenaOrigin)).pathname, "/login");
  assert.equal(jar.has("arena_session"), false, "state failures must not issue an Arena session");
});

test("Arena SSO return paths never leave the Arena origin", async () => {
  requireLocalIntegrationConfig();
  for (const input of ["https://evil.example", "//evil.example", "\\\\evil.example", "%2F%2Fevil.example", "javascript:alert(1)", "data:text/html,evil"]) {
    const jar = await createArenaSession(input);
    const logout = await request(`${arenaOrigin}/auth/logout`, jar, { method: "POST", headers: { origin: arenaOrigin } });
    assert.equal(logout.status, 303, "test fixture session should be revoked after each redirect check");
  }
});

test("inactive canonical and suspended Arena identities are rejected", async () => {
  requireLocalIntegrationConfig();
  const canonicalJar = await createArenaSession();
  const canonicalSession = await getArenaSession(canonicalJar);
  try {
    await canonicalSql(`update users set status = 'SUSPENDED' where id = '${canonicalSession.auth_subject}'`);
    const inactive = await introspect(canonicalSession.canonical_grant_id);
    assert.equal(inactive.status, 200);
    assert.equal(inactive.body.active, false, "Canonical suspension must make its grant inactive");
    const sql = arenaDatabase();
    try {
      await sql`update identity.sessions set last_canonical_check_at = now() - interval '6 minutes' where id = ${canonicalSession.id}`;
    } finally {
      await sql.end({ timeout: 5 });
    }
    const denied = await request(`${arenaOrigin}/app`, canonicalJar);
    assert.ok(denied.status >= 300 && denied.status < 400, "Arena must reject a suspended canonical identity once revalidation is due");
  } finally {
    await canonicalSql(`update users set status = 'ACTIVE' where id = '${canonicalSession.auth_subject}'`);
  }

  const arenaJar = await createArenaSession();
  const arenaSession = await getArenaSession(arenaJar);
  const sql = arenaDatabase();
  try {
    await sql`update identity.users set status = 'SUSPENDED' where auth_subject = ${arenaSession.auth_subject}`;
    const denied = await request(`${arenaOrigin}/app`, arenaJar);
    assert.ok(denied.status >= 300 && denied.status < 400, "Arena must reject its suspended local identity");
  } finally {
    await sql`update identity.users set status = 'ACTIVE' where auth_subject = ${arenaSession.auth_subject}`;
    await sql.end({ timeout: 5 });
  }
});

test("authorization code storage, PKCE, replay, redirect matching, and expiry are enforced", async () => {
  requireLocalIntegrationConfig();

  const pkce = await issueAuthorizationCode();
  try {
    const codeHash = createHash("sha256").update(pkce.code).digest("hex");
    assert.equal(await canonicalSql(`select count(*) from sso_authorization_codes where code_hash = '${codeHash}'`), "1", "authorization code must be persisted as a hash");
    const wrongVerifier = await exchangeCode({ ...pkce, verifier: randomBytes(32).toString("base64url") });
    assert.equal(wrongVerifier.status, 400, "wrong PKCE verifier must be rejected");
    const correct = await exchangeCode(pkce);
    assert.equal(correct.status, 200, "correct PKCE verifier must remain usable after a failed verifier");
    const replay = await exchangeCode(pkce);
    assert.equal(replay.status, 400, "authorization code must be single use");
  } finally {
    await logoutCanonicalJar(pkce.jar);
  }

  const redirect = await issueAuthorizationCode();
  try {
    const mismatched = await exchangeCode({ ...redirect, redirectUri: `${arenaOrigin}/auth/callback?unexpected=1` });
    assert.equal(mismatched.status, 400, "token exchange must require the exact redirect URI");
    assert.equal((await exchangeCode(redirect)).status, 200, "redirect mismatch must not consume the authorization code");
  } finally {
    await logoutCanonicalJar(redirect.jar);
  }

  const expired = await issueAuthorizationCode();
  try {
    const codeHash = createHash("sha256").update(expired.code).digest("hex");
    await canonicalSql(`update sso_authorization_codes set expires_at = now() - interval '1 second' where code_hash = '${codeHash}'`);
    assert.equal((await exchangeCode(expired)).status, 400, "expired authorization code must be rejected");
  } finally {
    await logoutCanonicalJar(expired.jar);
  }

  const concurrent = await issueAuthorizationCode();
  try {
    const statuses = (await Promise.all([exchangeCode(concurrent), exchangeCode(concurrent)])).map((result) => result.status).sort();
    assert.deepEqual(statuses, [200, 400], "transactional authorization-code consume must allow exactly one concurrent exchange");
  } finally {
    await logoutCanonicalJar(concurrent.jar);
  }
});

outageTest("Canonical outage fails closed when Arena revalidation is due", async () => {
  requireLocalIntegrationConfig();
  const jar = await createArenaSession();
  const session = await getArenaSession(jar);
  const sql = arenaDatabase();
  try {
    await sql`update identity.sessions set last_canonical_check_at = now() - interval '6 minutes' where id = ${session.id}`;
  } finally {
    await sql.end({ timeout: 5 });
  }

  await stopCanonicalDevServer();
  try {
    const app = await request(`${arenaOrigin}/app`, jar);
    assert.ok(app.status >= 300 && app.status < 400, "Arena must fail closed while Canonical introspection is unavailable");
    const verification = arenaDatabase();
    try {
      const rows = await verification`select revoked_at from identity.sessions where id = ${session.id}`;
      assert.ok(rows[0].revoked_at, "failed introspection must revoke the Arena local session");
    } finally {
      await verification.end({ timeout: 5 });
    }
  } finally {
    await startCanonicalDevServer();
  }
});
