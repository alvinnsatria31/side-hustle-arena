/**
 * Smoke-test the built app against the local sandbox, on a spare port.
 *
 * `local-dev.mjs` runs `next dev`, which takes a per-project lock and refuses
 * to start beside another dev server. `next start` has no such lock, so this
 * boots the production build against the isolated sandbox database (never the
 * cloud one) purely to confirm pages render and admin guards answer. It prints
 * status lines, never secrets.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { SignJWT } from 'jose';
import { localEnvironment } from './local-env.mjs';
import { PARTICIPANT_COOKIE } from '../src/server/auth/participant-token.ts';

const PORT = 3007;
const env = { ...localEnvironment({ create: false }), PORT: String(PORT) };
// The admin console needs a subject on the allowlist; the fixture admin uses this.
env.ARENA_ADMIN_SUBJECTS = 'sk-participant:local-sandbox-admin';
// The n8n machine path: a bearer token, scoped to projects, distinct from the
// worker token. This is how an off-schedule release is triggered in production,
// and unlike a session POST it does not require a same-origin HTTPS request —
// so it is also the honest way to exercise the mutation under `next start`.
env.INTERNAL_ADMIN_TOKEN = 'smoke-admin-token-distinct';
env.INTERNAL_ADMIN_SUBJECT = 'service:smoke';
env.INTERNAL_ADMIN_SCOPES = 'projects';
env.INTERNAL_AUTOMATION_TOKEN = 'smoke-worker-token-other';

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(PORT)], {
  env, stdio: 'inherit', shell: false,
});

const base = `http://127.0.0.1:${PORT}`;
let failures = 0;

/** An instant `dayOffset` days ahead at `hour` WIB, as an ISO string. */
function jakartaInstant(dayOffset, hour) {
  const now = new Date(Date.now() + 7 * 3_600_000);
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset));
  return `${day.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00:00+07:00`;
}

function runBootstrap() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', './scripts/node-test-hooks.mjs', 'scripts/bootstrap-generation-library.mjs'], { env, stdio: 'inherit', shell: false });
    child.once('exit', (code) => { if (code) console.log(`      (bootstrap exited ${code} — some divisions may lack a source project)`); resolve(); });
    child.once('error', () => resolve());
  });
}

async function ready() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${base}/dev`, { redirect: 'manual' });
      if (response.status < 500) return true;
    } catch {
      // not up yet
    }
    await delay(500);
  }
  return false;
}

async function check(name, path, expected, init) {
  try {
    const response = await fetch(`${base}${path}`, { redirect: 'manual', ...init });
    const ok = expected.includes(response.status);
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${response.status} (expected ${expected.join('/')}) ${path}`);
    return response;
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name} — threw ${error?.message ?? error} ${path}`);
    return null;
  }
}

try {
  if (!(await ready())) throw new Error('server did not become ready');
  console.log(`\nSandbox build serving on ${base}\n`);

  // Public and gated surfaces respond without a session. /dev is dev-only and
  // must 404 under `next start` (production NODE_ENV) — that is the guard working.
  await check('dev fixtures refused in production', '/dev', [404]);
  await check('admin API unauthenticated', '/api/internal/admin/audit', [401, 403]);
  await check('admin jobs API unauthenticated', '/api/internal/admin/jobs', [401, 403]);
  await check('launch endpoint rejects worker/none', '/api/internal/admin/launch', [401, 403], {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'smoke' }),
  });

  // The /dev fixtures are dev-only and refuse under `next start` (production
  // NODE_ENV), so mint the same participant JWT the fixture would — sub
  // local-sandbox-admin, which ARENA_ADMIN_SUBJECTS grants every scope.
  const token = await new SignJWT({ sub: 'local-sandbox-admin', email: 'admin@arena.local.invalid', username: 'local-admin', firstName: 'LOCAL FIXTURE admin' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(env.SESSION_SECRET));
  const cookie = `${PARTICIPANT_COOKIE}=${token}`;
  {
    const auth = { headers: { cookie } };
    await check('admin overview page (session)', '/app/admin', [200], auth);
    await check('admin audit page (session)', '/app/admin/audit', [200], auth);
    await check('admin jobs page (session)', '/app/admin/jobs', [200], auth);
    await check('admin projects page (session)', '/app/admin/projects', [200], auth);
    await check('admin divisions page (session)', '/app/admin/divisions', [200], auth);
    await check('admin weeks page (session)', '/app/admin/weeks', [200], auth);
    await check('audit API (session)', '/api/internal/admin/audit?limit=5', [200], auth);
    await check('jobs API (session)', '/api/internal/admin/jobs', [200], auth);
    await check('divisions API (session)', '/api/internal/admin/divisions', [200], auth);

    // The full off-schedule release chain, end to end against the sandbox DB.
    // Generation needs a frozen base rubric per division; the core seed does
    // not create one, so bootstrap first — exactly the production setup step.
    console.log('\n--- running db:bootstrap:library against the sandbox ---');
    await runBootstrap();

    // Bootstrap ran in a child process; confirm the server itself is still up
    // before blaming the launch for any connection error.
    await check('server alive after bootstrap', '/app/admin', [200], auth);

    // A session POST from a cross-origin http caller is correctly refused under
    // production hardening (mutation origin must be same-site HTTPS), so confirm
    // that, then drive the real mutation through the bearer path n8n uses.
    await check('session POST refused cross-origin (hardening)', '/api/internal/admin/launch', [403], {
      method: 'POST', headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'origin check' }),
    });
    // The shared worker token must never release content, even with a valid scope elsewhere.
    await check('worker token refused', '/api/internal/admin/launch', [403], {
      method: 'POST', headers: { authorization: 'Bearer smoke-worker-token-other', 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'worker' }),
    });

    console.log('\n--- POST /api/internal/admin/launch via bearer (Tuesday, approve, no publish) ---');
    const opensAt = jakartaInstant(2, 8);   // ~Tuesday 08:00 WIB
    const deadline = jakartaInstant(6, 23);  // ~Saturday 23:00 WIB
    // A unique code each run so re-runs do not collide on an existing week.
    const weekCode = `SMOKE-${Date.now()}`;
    const launch = await check('off-schedule launch (bearer)', '/api/internal/admin/launch', [200], {
      method: 'POST', headers: { authorization: 'Bearer smoke-admin-token-distinct', 'content-type': 'application/json' },
      body: JSON.stringify({ weekCode, title: 'Sandbox smoke release', opensAt, submissionDeadlineAt: deadline, approve: true, publish: false, reason: 'sandbox smoke test' }),
    });
    const payload = launch ? await launch.clone().json().catch(() => null) : null;
    if (!launch?.ok) console.log(`      response: ${JSON.stringify(payload)}`);
    if (launch?.ok) {
      const { data } = payload ?? await launch.json();
      const steps = (data.steps ?? []).map((step) => `${step.step}:${step.ok ? 'ok' : 'attention'}`).join(' ');
      console.log(`      week ${data.weekCode} (created=${data.created}) — ${steps}`);
      const generate = (data.steps ?? []).find((step) => step.step === 'generate');
      if (generate?.ok) console.log('      generation produced content end to end.');
      else { failures += 1; console.log(`      FAIL generation did not succeed: ${JSON.stringify(generate?.detail)}`); }
    }
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} catch (error) {
  console.error('SMOKE ERROR:', error?.message ?? error);
  failures += 1;
} finally {
  server.kill('SIGTERM');
  await delay(500);
  process.exitCode = failures ? 1 : 0;
}
