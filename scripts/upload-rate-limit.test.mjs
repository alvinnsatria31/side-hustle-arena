// Offline coverage for the two server-hardening changes: the production
// SESSION_SECRET floor and the per-user upload rate limiter.
//
// Needs no database and no network: the limiter takes an injected stub counter
// with the same upsert shape as the CV scanner's test double, and the secret
// check runs through the real token verifier with a locally minted JWT.
// Deliberately contains no live-database access, so `npm run test:offline`
// picks it up automatically.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';

const limiter = await import('../src/server/submissions/upload-rate-limit.ts');
const tokenApi = await import('../src/server/auth/participant-token.ts');
const errorsApi = await import('../src/server/arena/errors.ts');

const {
  checkUploadRateLimit,
  resetUploadRateLimit,
  uploadRateLimitSubject,
  UPLOAD_PRESIGN_MAX_PER_WINDOW,
  UPLOAD_FINALIZE_MAX_PER_WINDOW,
} = limiter;

// ---------------------------------------------------------------------------
// Limiter configuration
// ---------------------------------------------------------------------------

test('upload allowances are 20 presigns and 5 finalizes per user per hour', () => {
  assert.equal(UPLOAD_PRESIGN_MAX_PER_WINDOW, 20);
  assert.equal(UPLOAD_FINALIZE_MAX_PER_WINDOW, 5);
  assert.equal(uploadRateLimitSubject('abc'), 'user:abc');
});

/**
 * Stands in for the shared counter. The upsert is the whole point of the
 * limiter, so the stub implements exactly it: one row per
 * (bucket, subject, window), returning the running total.
 */
function sharedCounterStub() {
  const rows = new Map();
  return {
    rows,
    insert: () => ({
      values: (value) => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            const key = `${value.bucket}|${value.subject}|${value.windowStart.getTime()}`;
            rows.set(key, (rows.get(key) ?? 0) + 1);
            return [{ count: rows.get(key) }];
          },
        }),
      }),
    }),
  };
}

test('presign allows a full file set with retry headroom, then refuses with a retry hint', async () => {
  const db = sharedCounterStub();
  const now = Date.now();
  const subject = uploadRateLimitSubject('user-presign');
  for (let i = 0; i < UPLOAD_PRESIGN_MAX_PER_WINDOW; i += 1) {
    const call = await checkUploadRateLimit('presign', subject, now, db);
    assert.equal(call.allowed, true, `call ${i + 1} should pass`);
    assert.equal(call.degraded, false, 'the shared counter was available; this must not report degraded');
  }
  const blocked = await checkUploadRateLimit('presign', subject, now, db);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0, 'the client needs to know when to come back');

  // A different user is unaffected, and the window eventually reopens.
  assert.equal((await checkUploadRateLimit('presign', uploadRateLimitSubject('other-user'), now, db)).allowed, true);
  assert.equal((await checkUploadRateLimit('presign', subject, now + 61 * 60 * 1000, db)).allowed, true);
});

test('finalize allows one full submission per hour and is independent of presign', async () => {
  const db = sharedCounterStub();
  const now = Date.now();
  const subject = uploadRateLimitSubject('user-finalize');
  for (let i = 0; i < UPLOAD_FINALIZE_MAX_PER_WINDOW; i += 1) {
    assert.equal((await checkUploadRateLimit('finalize', subject, now, db)).allowed, true, `finalize ${i + 1} should pass`);
  }
  assert.equal((await checkUploadRateLimit('finalize', subject, now, db)).allowed, false, 'the sixth finalize must lose');

  // Separate bucket: spending the finalize allowance must not touch presign.
  assert.equal((await checkUploadRateLimit('presign', subject, now, db)).allowed, true);
});

test('the shared counter is what limits, not the instance that happens to serve', async () => {
  // Two "instances" here means two callers of the same shared row — the
  // over-limit call must lose regardless of which one makes it.
  const db = sharedCounterStub();
  const now = Date.now();
  const subject = uploadRateLimitSubject('user-shared');
  for (let i = 0; i < UPLOAD_FINALIZE_MAX_PER_WINDOW; i += 1) {
    assert.equal((await checkUploadRateLimit('finalize', subject, now, db)).allowed, true);
  }
  assert.equal((await checkUploadRateLimit('finalize', subject, now, db)).allowed, false);
});

test('an unreachable counter degrades to a local limiter instead of an outage', async () => {
  resetUploadRateLimit();
  const broken = { insert: () => { throw new Error('connection refused'); } };
  const now = Date.now();
  const subject = uploadRateLimitSubject('user-degraded');

  const first = await checkUploadRateLimit('presign', subject, now, broken);
  assert.equal(first.allowed, true, 'a database blip must not take uploads down');
  assert.equal(first.degraded, true, 'the service needs to know the guard is weakened');

  // Still a speed bump: the fallback is never weaker than no limiter at all.
  for (let i = 0; i < UPLOAD_PRESIGN_MAX_PER_WINDOW - 1; i += 1) {
    await checkUploadRateLimit('presign', subject, now, broken);
  }
  const blocked = await checkUploadRateLimit('presign', subject, now, broken);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.degraded, true);
  resetUploadRateLimit();
});

test('RATE_LIMITED travels through the arena envelope as a 429', () => {
  const response = errorsApi.toArenaErrorResponse(
    new errorsApi.ArenaDomainError('RATE_LIMITED', 'Too many upload requests. Try again later.', { retryAfterSeconds: 42 }),
  );
  assert.equal(response.status, 429);
  assert.equal(response.body.error.code, 'RATE_LIMITED');
  assert.equal(response.body.error.details.retryAfterSeconds, 42);
});

// ---------------------------------------------------------------------------
// SESSION_SECRET production floor
// ---------------------------------------------------------------------------

const claims = { sub: 'p-1', email: 'peserta@example.test', username: 'peserta', firstName: 'Peserta' };

async function mint(secret) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode(secret));
}

async function withEnv(env, fn) {
  const saved = { APP_ENV: process.env.APP_ENV, SESSION_SECRET: process.env.SESSION_SECRET };
  try {
    if (env.APP_ENV === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = env.APP_ENV;
    if (env.SESSION_SECRET === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = env.SESSION_SECRET;
    return await fn();
  } finally {
    if (saved.APP_ENV === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = saved.APP_ENV;
    if (saved.SESSION_SECRET === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = saved.SESSION_SECRET;
  }
}

test('a short production secret fails closed without printing the secret', async () => {
  const weak = 'weak-test-secret-123';
  assert.ok(weak.length < 32);
  await withEnv({ APP_ENV: 'production', SESSION_SECRET: weak }, async () => {
    const token = await mint(weak);
    await assert.rejects(
      tokenApi.verifyParticipantToken(token),
      (error) => {
        assert.equal(error.name, 'ParticipantSecretWeakError');
        assert.ok(!String(error.message).includes(weak), 'the refusal must not echo the secret');
        return true;
      },
    );
  });
});

test('the floor is exactly 32 characters in production', async () => {
  await withEnv({ APP_ENV: 'production', SESSION_SECRET: 's'.repeat(31) }, async () => {
    await assert.rejects(
      tokenApi.verifyParticipantToken(await mint('s'.repeat(31))),
      (error) => error.name === 'ParticipantSecretWeakError',
    );
  });
  await withEnv({ APP_ENV: 'production', SESSION_SECRET: 's'.repeat(32) }, async () => {
    const verified = await tokenApi.verifyParticipantToken(await mint('s'.repeat(32)));
    assert.deepEqual(verified, claims);
  });
});

test('short secrets still work outside production, so CI and the sandbox are unaffected', async () => {
  // CI builds with APP_ENV=test, the sandbox runs development/test: neither
  // may start failing because of a production-only gate.
  for (const appEnv of ['development', 'test', undefined]) {
    await withEnv({ APP_ENV: appEnv, SESSION_SECRET: 'short' }, async () => {
      const verified = await tokenApi.verifyParticipantToken(await mint('short'));
      assert.deepEqual(verified, claims, `APP_ENV=${appEnv} must keep accepting short secrets`);
    });
  }
});
