// Regression suite for docs/backend/WEBSITE_WIDE_AUDIT_2026-09-11.md.
//
// These began as probes that PASSED while each defect was present. Every test
// now asserts the corrected behaviour: a pass means the fix holds, a failure is
// a regression. It reuses the lifecycle fixture — a FINALIZED week with one
// ranked participant and one skill-evidence row — and touches only the local
// sandbox: no live database, provider, email, voucher or webhook. W1 (browser
// storage) and W6 (profile wording) are covered offline by
// scripts/demo-cv-isolation.test.mjs and scripts/skill-evidence-label.test.mjs.
//
//   node scripts/local-dev.mjs --setup-only
//   node scripts/audit-website-wide.mjs
//
// Run it on its own: lifecycle-based suites share the active-week resolver.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = new URL(`./.audit-wide-${process.pid}.mjs`, import.meta.url);
let source = readFileSync(new URL('./arena-lifecycle-integration.test.mjs', import.meta.url), 'utf8');

/** Splice extra teardown into the fixture's cleanup; refuse to run if the anchor moved. */
function patch(anchor, replacement) {
  if (!source.includes(anchor)) throw new Error(`Lifecycle fixture changed; cleanup anchor not found: ${anchor}`);
  source = source.replace(anchor, replacement);
}
patch('if (fixture.userId) {', 'if (fixture.userId) {\n    await db.delete(schema.redemptions).where(eq(schema.redemptions.userId, fixture.userId));\n    for (const id of fixture.auditRewardIds ?? []) await db.delete(schema.catalog).where(eq(schema.catalog.id, id));');

source += `
const auditAdmin = STAMP + '-admin';

async function withVoucherContract(run) {
  const saved = { origin: process.env.MAIN_SITE_ORIGIN, token: process.env.MAIN_SITE_VOUCHER_TOKEN };
  process.env.MAIN_SITE_ORIGIN = 'https://voucher.example.invalid';
  process.env.MAIN_SITE_VOUCHER_TOKEN = 'isolated-audit-not-a-real-token';
  try { return await run(); } finally {
    if (saved.origin === undefined) delete process.env.MAIN_SITE_ORIGIN; else process.env.MAIN_SITE_ORIGIN = saved.origin;
    if (saved.token === undefined) delete process.env.MAIN_SITE_VOUCHER_TOKEN; else process.env.MAIN_SITE_VOUCHER_TOKEN = saved.token;
  }
}

async function voucherSku(suffix) {
  const [sku] = await db.insert(schema.catalog).values({ slug: STAMP + '-' + suffix, title: 'Audit voucher ' + suffix, pointsCost: 100, rewardType: 'DISCOUNT', inventoryMode: 'UNLIMITED', isActive: true }).returning();
  (fixture.auditRewardIds ??= []).push(sku.id);
  return sku;
}

test('W3: archiving a finalized week keeps completed projects, skill evidence, the report and Jobs skills', async () => {
  const { getParticipantOverview } = await import('../src/server/arena/participant-service.ts');
  const { getJobsOverview } = await import('../src/server/career/jobs-service.ts');
  const { buildCareerReport } = await import('../src/server/career/report.ts');
  const { getArenaResult } = await import('../src/server/finalization/result-service.ts');
  const { listAdminCareerReports } = await import('../src/server/admin/career-report.ts');
  const before = await getParticipantOverview(fixture.userId, db);
  assert.ok(before.completedProjects > 0, 'premise: the fixture has a finalized result');
  assert.ok(before.skillEvidence.length > 0, 'premise: the fixture has skill evidence');
  await db.update(schema.weeks).set({ status: 'ARCHIVED' }).where(eq(schema.weeks.id, fixture.weekId));
  try {
    const after = await getParticipantOverview(fixture.userId, db);
    const jobs = await getJobsOverview(fixture.userId, { db, limit: 1 });
    const result = await getArenaResult({ userId: fixture.userId, enrollmentId: fixture.enrollmentId, db });
    const report = buildCareerReport(after);
    const [adminRow] = await listAdminCareerReports({ offset: 0, limit: 5, q: STAMP + '-participant' }, db);
    assert.equal(after.completedProjects, before.completedProjects);
    assert.equal(after.skillEvidence.length, before.skillEvidence.length);
    assert.equal(after.provenSkills, before.provenSkills);
    const row = after.history.find((entry) => entry.id === fixture.enrollmentId);
    assert.equal(row.sealed, false, 'the profile agrees with the result page that the result is out');
    assert.ok(row.ranking);
    assert.equal(result.sealed, false);
    assert.equal(report.projectsCompleted, before.completedProjects);
    assert.ok(report.skills.length > 0);
    assert.ok(jobs.skills.length > 0, 'Jobs matching still sees the evidence');
    assert.equal(adminRow?.projectsCompleted, before.completedProjects, 'the admin summary counts it too');
    assert.ok(after.skillEvidence.every((item) => item.attribution === 'CRITERION' || item.attribution === 'PROJECT'), 'attribution reaches the profile');
  } finally {
    await db.update(schema.weeks).set({ status: 'FINALIZED' }).where(eq(schema.weeks.id, fixture.weekId));
  }
});

test('W4: an OPEN opening past its deadline is not shown before a sync marks it EXPIRED', async () => {
  const { getJobsOverview } = await import('../src/server/career/jobs-service.ts');
  const now = new Date();
  const [src] = await db.insert(schema.jobSources).values({ slug: STAMP + '-expired', name: 'Audit expiry source', adapter: 'http-json', config: {}, isActive: true, lastSuccessfulSyncAt: now }).returning();
  try {
    const opening = (key, expiresAt) => ({ sourceId: src.id, externalId: key, canonicalKey: STAMP + '-' + key, title: 'Audit role ' + key, company: 'Audit only', applicationUrl: 'https://example.invalid/' + key, contentHash: key, status: 'OPEN', postedAt: now, lastSeenAt: now, expiresAt });
    const [expired] = await db.insert(schema.jobOpenings).values(opening('expired', new Date(now.getTime() - 60000))).returning();
    const [live] = await db.insert(schema.jobOpenings).values(opening('live', new Date(now.getTime() + 86400000))).returning();
    const result = await getJobsOverview(fixture.userId, { db, now, filters: { sourceSlug: src.slug } });
    assert.equal(result.jobs.some((job) => job.id === expired.id), false, 'a passed deadline is not offered as live');
    assert.ok(result.jobs.some((job) => job.id === live.id));
    assert.equal(result.totalMatching, 1);
    assert.equal(result.sources.find((entry) => entry.slug === src.slug).openOpenings, 1);
  } finally { await db.delete(schema.jobSources).where(eq(schema.jobSources.id, src.id)); }
});

test('W5: search, matching and totals reach an opening older than the newest 200', async () => {
  const { getJobsOverview } = await import('../src/server/career/jobs-service.ts');
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.id, fixture.skillId));
  const [src] = await db.insert(schema.jobSources).values({ slug: STAMP + '-cap', name: 'Audit capped source', adapter: 'http-json', config: {}, isActive: true }).returning();
  try {
    const [older] = await db.insert(schema.jobOpenings).values({ sourceId: src.id, externalId: 'older', canonicalKey: STAMP + '-older', title: 'Unique older audit role', company: 'Audit only', applicationUrl: 'https://example.invalid/older', contentHash: 'audit', status: 'OPEN', postedAt: new Date('2098-01-01'), requiredSkills: [skill.name] }).returning();
    await db.insert(schema.jobOpeningSkills).values({ jobOpeningId: older.id, skillId: skill.id, kind: 'REQUIRED', matchedAlias: skill.name });
    await db.insert(schema.jobOpenings).values(Array.from({ length: 200 }, (_, i) => ({ sourceId: src.id, externalId: String(i), canonicalKey: STAMP + '-' + i, title: 'New audit role ' + i, company: 'Audit only', applicationUrl: 'https://example.invalid/' + i, contentHash: 'audit', status: 'OPEN', postedAt: new Date('2099-01-01') })));
    const all = await getJobsOverview(fixture.userId, { db, filters: { sourceSlug: src.slug } });
    assert.equal(all.totalMatching, 201);
    assert.ok(all.totalOpen >= 201, 'the total is counted, not taken from a truncated list');
    assert.equal(all.sources.find((entry) => entry.slug === src.slug).openOpenings, 201);
    // The participant has finalized evidence for this skill, so the oldest role is the best match.
    assert.equal(all.jobs[0].id, older.id);
    assert.equal(all.jobs[0].matchScore, 100);
    const found = await getJobsOverview(fixture.userId, { db, filters: { sourceSlug: src.slug, search: 'Unique older audit role' } });
    assert.deepEqual(found.jobs.map((job) => job.id), [older.id]);
  } finally { await db.delete(schema.jobSources).where(eq(schema.jobSources.id, src.id)); }
});

test('W2: a refund during voucher delivery is refused, so a pushed code never coexists with refunded points', async () => {
  const { claimRedemption, reverseRedemption } = await import('../src/server/rewards/redemption-service.ts');
  const { deliverVoucherReward, voucherCodeFor } = await import('../src/server/rewards/voucher-push.ts');
  const { getParticipantOverview } = await import('../src/server/arena/participant-service.ts');
  const sku = await voucherSku('race');
  const before = await getParticipantOverview(fixture.userId, db);
  const claim = await claimRedemption({ userId: fixture.userId, slug: sku.slug, db });
  let refusal = null;
  const delivery = await withVoucherContract(() => deliverVoucherReward({ redemptionId: claim.redemptionId, db, fetcher: async () => {
    // Deterministic interleaving: the admin reverses while the request is in flight.
    refusal = await reverseRedemption({ redemptionId: claim.redemptionId, actorSubject: auditAdmin, reason: 'Isolated race audit', db }).then(() => null, (error) => error);
    return new Response('{}', { status: 201 });
  } }));
  assert.equal(refusal?.code, 'REWARD_DELIVERY_IN_PROGRESS');
  assert.equal(delivery.status, 'DELIVERED');
  const after = await getParticipantOverview(fixture.userId, db);
  const row = after.redemptions.find((entry) => entry.id === claim.redemptionId);
  assert.equal(row.status, 'FULFILLED');
  assert.ok(row.deliveryNote.includes(voucherCodeFor(claim.redemptionId)), 'the participant can read the code');
  assert.equal(after.points.balance, before.points.balance - sku.pointsCost, 'no refund while the code went out');
});

test('W2: a code accepted after a lapsed lease is voided, and an unconfirmed void is flagged in the admin queue', async () => {
  const { claimRedemption, reverseRedemption } = await import('../src/server/rewards/redemption-service.ts');
  const { deliverVoucherReward } = await import('../src/server/rewards/voucher-push.ts');
  const { listAdminRedemptions } = await import('../src/server/admin/operations.ts');
  const { getParticipantOverview } = await import('../src/server/arena/participant-service.ts');
  const sku = await voucherSku('lapsed');
  const before = await getParticipantOverview(fixture.userId, db);
  const claim = await claimRedemption({ userId: fixture.userId, slug: sku.slug, db });
  const calls = [];
  const delivery = await withVoucherContract(() => deliverVoucherReward({ redemptionId: claim.redemptionId, db, fetcher: async (url) => {
    calls.push(String(url));
    if (calls.length === 1) {
      // The push stalls past its lease, which lets a reversal through meanwhile.
      await db.update(schema.redemptions).set({ updatedAt: new Date(Date.now() - 120000) }).where(eq(schema.redemptions.id, claim.redemptionId));
      await reverseRedemption({ redemptionId: claim.redemptionId, actorSubject: auditAdmin, reason: 'Lapsed lease audit', db });
      return new Response('{}', { status: 201 });
    }
    return new Response('', { status: 503 });
  } }));
  assert.equal(delivery.status, 'REVOKED');
  assert.equal(delivery.voided, false);
  assert.match(calls[1], /\\/api\\/v1\\/vouchers\\/ARENA-[0-9A-F]{12}\\/void$/);
  const after = await getParticipantOverview(fixture.userId, db);
  assert.equal(after.redemptions.find((entry) => entry.id === claim.redemptionId).status, 'ADMIN_REVERSED');
  assert.equal(after.points.balance, before.points.balance);
  const queue = await listAdminRedemptions({ limit: 50, offset: 0 }, 'ADMIN_REVERSED', db);
  const flagged = queue.find((entry) => entry.id === claim.redemptionId);
  assert.equal(flagged.voucher.revocation.voided, false, 'the admin queue shows the code may still be live');
  assert.equal(flagged.voucher.revocation.error, 'HTTP 503');
});

test('Inbox: cursor paging reads the whole history past 100 messages, without skips or repeats', async () => {
  const { listUserNotificationPage } = await import('../src/server/notifications/service.ts');
  const base = Date.parse('2030-01-01T00:00:00.000Z');
  // Ten messages per millisecond: equal timestamps must be ordered by id, not skipped.
  await db.insert(schema.events).values(Array.from({ length: 130 }, (_, i) => ({ type: 'REWARD_REDEEMED', userId: fixture.userId, title: STAMP + ' inbox ' + i, body: 'Paging regression', createdAt: new Date(base + Math.floor(i / 10)) })));
  const total = (await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.userId, fixture.userId))).length;
  assert.ok(total > 100, 'premise: more history than the old 100-message ceiling');
  const seen = [];
  let cursor = null;
  do {
    const page = await listUserNotificationPage(fixture.userId, { limit: 25, cursor }, db);
    seen.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(seen.length, total);
  assert.equal(new Set(seen).size, total);
});
`;
try {
  writeFileSync(target, source, { flag: 'wx' });
  const result = spawnSync(process.execPath, ['--import', './scripts/node-test-hooks.mjs', '--test', '--test-force-exit', fileURLToPath(target)], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { unlinkSync(target); }
