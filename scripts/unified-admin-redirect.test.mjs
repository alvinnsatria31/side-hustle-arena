import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { NextRequest } from 'next/server.js';
import nextConfig from '../next.config.mjs';
import { CENTRAL_COVERED_SECTIONS, LEGACY_ONLY_SECTIONS, legacySectionsKept, resolveCentralAdmin } from '../src/server/admin/central-admin.ts';
import { proxy, config } from '../src/proxy.ts';

const CENTRAL = 'https://www.sekolahkarir.id/admin/integrations/arena';
const production = { NODE_ENV: 'production', APP_ENV: 'production', ARENA_ORIGIN: 'https://arena.sekolahkarir.id' };

/** Run the real proxy with a controlled environment, restoring whatever was there. */
function withEnv(values, run) {
  const keys = ['ARENA_CENTRAL_ADMIN_URL', 'ARENA_LEGACY_ADMIN_KEEP', 'ARENA_ORIGIN', 'NODE_ENV', 'APP_ENV'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
    return run();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}
const visit = (path) => proxy(new NextRequest(`https://arena.sekolahkarir.id${path}`));

test('shipping the API does not retire the console: the redirect is off until configured', () => {
  // The API and the redirect travel in one image, and the API has to be live
  // before the central panel can use it. A default-on redirect would take the
  // only working admin away on the day the API ships.
  assert.deepEqual(resolveCentralAdmin(production), { enabled: false, reason: 'unset' });
  assert.deepEqual(resolveCentralAdmin({ ...production, ARENA_CENTRAL_ADMIN_URL: '   ' }), { enabled: false, reason: 'unset' });
  withEnv(production, () => {
    const response = visit('/app/admin/reviews');
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('x-middleware-next'), '1', 'the legacy console is served as before');
  });
});

test('one runtime variable turns it on, and removing it is the rollback', () => {
  withEnv({ ...production, ARENA_CENTRAL_ADMIN_URL: CENTRAL }, () => {
    for (const path of ['/app/admin', '/app/admin/users', '/app/admin/audit/2026', '/admin', '/admin/store']) {
      const response = visit(path);
      assert.equal(response.status, 307, `${path} must be a temporary redirect`);
      assert.equal(response.headers.get('location'), CENTRAL);
      assert.equal(response.headers.get('cache-control'), 'no-store', 'a cached redirect would outlive a rollback');
    }
  });
  withEnv(production, () => assert.equal(visit('/app/admin').headers.get('location'), null));
});

test('what the central panel cannot do yet stays reachable while the redirect is on', () => {
  // The email outbox, scheduler and ad-hoc launch have no screen in the
  // unified admin. Redirecting them would not move that work, it would remove
  // it — in the middle of an incident, from the only place it can be done.
  withEnv({ ...production, ARENA_CENTRAL_ADMIN_URL: CENTRAL }, () => {
    for (const path of ['/app/admin/email', '/app/admin/jobs', '/app/admin/workflows', '/app/admin/careers', '/app/admin/career-report', '/app/admin/cv-scanner']) {
      assert.equal(visit(path).headers.get('location'), null, `${path} has no central equivalent and must stay`);
    }
    // These have a screen in the panel but not every action: file upload and
    // manual payment confirmation, voucher push and void, project edit.
    for (const path of ['/app/admin/store', '/app/admin/rewards', '/app/admin/projects/abc', '/app/admin/weeks']) {
      assert.equal(visit(path).headers.get('location'), null, `${path} still does something the panel cannot`);
    }
    // Each of these was run from the panel against Arena before it moved here.
    for (const path of ['/app/admin', '/app/admin/audit', '/app/admin/users', '/app/admin/flags', '/app/admin/divisions', '/app/admin/reviews']) {
      assert.equal(visit(path).headers.get('location'), CENTRAL, `${path} is covered by the central panel`);
    }
  });
  assert.deepEqual(legacySectionsKept({}), [...LEGACY_ONLY_SECTIONS]);

  // As the panel gains a screen, the operator narrows the list — and `none`
  // retires the console entirely. A typo keeps more, never less, of nothing:
  // unknown names simply match no section.
  // The same variable is also how an operator keeps MORE than the default,
  // if a deployed panel turns out to be older than this list assumes.
  withEnv({ ...production, ARENA_CENTRAL_ADMIN_URL: CENTRAL, ARENA_LEGACY_ADMIN_KEEP: 'Flags, email' }, () => {
    assert.equal(visit('/app/admin/flags').headers.get('location'), null);
    assert.equal(visit('/app/admin/jobs').headers.get('location'), CENTRAL);
  });
  withEnv({ ...production, ARENA_CENTRAL_ADMIN_URL: CENTRAL, ARENA_LEGACY_ADMIN_KEEP: 'none' }, () => {
    assert.equal(visit('/app/admin/store').headers.get('location'), CENTRAL);
  });
  assert.deepEqual(legacySectionsKept({ ARENA_LEGACY_ADMIN_KEEP: 'flags;../etc, email' }), ['email']);

  // A kept name that matches no page protects nothing: a renamed folder would
  // silently start redirecting the tool it was meant to keep.
  for (const section of LEGACY_ONLY_SECTIONS) {
    assert.ok(existsSync(new URL(`../src/app/(app)/app/admin/${section}/page.tsx`, import.meta.url)), `no legacy page for "${section}"`);
  }

  // An unlisted path redirects, so a section added to the console later would
  // be retired the moment it shipped. Every folder is classified on purpose.
  const sections = readdirSync(new URL('../src/app/(app)/app/admin/', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual([...LEGACY_ONLY_SECTIONS, ...CENTRAL_COVERED_SECTIONS].sort(), sections,
    'every console section must be listed as kept or as covered by the central panel');
});

test('the admin API is never in the redirect path', () => {
  // The central panel calls these. Redirecting them would cut it off from Arena.
  const matchers = config.matcher.map((pattern) => new RegExp(`^${pattern.replace(/\/:path\*$/, '(?:/.*)?')}$`));
  const matches = (path) => matchers.some((matcher) => matcher.test(path));
  for (const path of ['/app/admin', '/app/admin/reviews', '/admin', '/admin/x/y']) assert.ok(matches(path), `${path} should be covered`);
  for (const path of ['/api/internal/admin/overview', '/api/internal/store/products', '/api/internal/reviews/admin', '/app/arena', '/app', '/administrasi']) {
    assert.ok(!matches(path), `${path} must not be covered`);
  }
  assert.ok(config.matcher.every((pattern) => !pattern.includes('/api')));
});

test('an unsafe destination leaves the console in place instead of redirecting somewhere wrong', () => {
  const unsafe = [
    ['not-a-url', /absolute URL/],
    ['https://name:password@www.sekolahkarir.id/admin/integrations/arena', /credentials/],
    ['https://www.sekolahkarir.id/admin/integrations/arena?next=https://evil.invalid', /query/],
    ['http://www.sekolahkarir.id/admin/integrations/arena', /HTTPS/],
    ['http://localhost:3100/admin/integrations/arena', /HTTPS/],
    ['https://arena.sekolahkarir.id/app/admin', /not the Arena itself/],
  ];
  for (const [value, problem] of unsafe) {
    const target = resolveCentralAdmin({ ...production, ARENA_CENTRAL_ADMIN_URL: value });
    assert.equal(target.enabled, false, value);
    assert.equal(target.reason, 'invalid');
    assert.match(target.problem, problem);
  }
  withEnv({ ...production, ARENA_CENTRAL_ADMIN_URL: 'https://arena.sekolahkarir.id/app/admin' }, () => {
    const original = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args.join(' '));
    try {
      assert.equal(visit('/app/admin').headers.get('location'), null, 'a self-redirect would lock every operator out');
      visit('/app/admin/reviews');
    } finally { console.error = original; }
    assert.equal(logged.length, 1, 'the misconfiguration is reported once, not on every navigation');
    assert.match(logged[0], /ARENA_CENTRAL_ADMIN_URL/);
  });
});

test('a loopback panel over HTTP is accepted only outside production', () => {
  const local = 'http://localhost:3100/admin/integrations/arena';
  assert.deepEqual(resolveCentralAdmin({ NODE_ENV: 'development', APP_ENV: 'development', ARENA_ORIGIN: 'http://localhost:3001', ARENA_CENTRAL_ADMIN_URL: local }), { enabled: true, url: local });
  assert.equal(resolveCentralAdmin({ ...production, ARENA_CENTRAL_ADMIN_URL: local }).enabled, false);
});

test('the destination is never decided at build time', () => {
  // next.config.mjs is evaluated by `next build`, which the image runs with
  // placeholder origins. A redirect declared there shipped pointing at
  // http://localhost:3000 and needed a rebuild to change.
  assert.equal(nextConfig.redirects, undefined);
  assert.doesNotMatch(readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8'), /ARENA_CENTRAL_ADMIN_URL/);
});
