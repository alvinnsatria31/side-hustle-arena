// Regression suite for docs/backend/ADMIN_USER_INTEGRATION_AUDIT_2026-09-11.md.
//
// It started life as probes that PASSED while each defect was present. Every
// test now asserts the corrected behaviour instead: a pass means the fix holds,
// a failure is a regression. It reuses the lifecycle fixture — by the time these
// run, that suite has left a week force-closed and FINALIZED before its
// deadline, with one ranked participant holding their first-place points (score
// + 200) — and touches only
// the local sandbox: no live database, provider, email or webhook.
//
//   node scripts/local-dev.mjs --setup-only
//   node scripts/audit-admin-user-integration.mjs
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = new URL(`./.audit-admin-user-${process.pid}.mjs`, import.meta.url);
let source = readFileSync(new URL('./arena-lifecycle-integration.test.mjs', import.meta.url), 'utf8');

/** Splice extra teardown into the fixture's cleanup; refuse to run if the anchor moved. */
function patch(anchor, replacement) {
  if (!source.includes(anchor)) throw new Error(`Lifecycle fixture changed; cleanup anchor not found: ${anchor}`);
  source = source.replace(anchor, replacement);
}
patch('if (reviewIds.length) {', 'if (reviewIds.length) {\n        await db.delete(schema.reviewOverrides).where(inArray(schema.reviewOverrides.reviewId, reviewIds));');
patch('if (fixture.userId) {', 'if (fixture.userId) {\n    await db.delete(schema.redemptions).where(eq(schema.redemptions.userId, fixture.userId));\n    for (const id of fixture.auditRewardIds ?? []) await db.delete(schema.catalog).where(eq(schema.catalog.id, id));');
patch('  if (fixture.divisionId) await db.delete(schema.divisions)', '  for (const id of fixture.auditDivisionIds ?? []) await db.delete(schema.divisions).where(eq(schema.divisions.id, id));\n  for (const id of fixture.auditJobSourceIds ?? []) await db.delete(schema.jobSources).where(eq(schema.jobSources.id, id));\n  if (fixture.divisionId) await db.delete(schema.divisions)');

source += `
const regressionAdmin = STAMP + '-admin';
const withCode = (code) => (error) => error?.code === code;

test('A1: override and rerun after finalization are refused, and the result still matches the review', async () => {
  const { overrideReview, rerunReview } = await import('../src/server/reviews/admin.ts');
  const { getArenaResult } = await import('../src/server/finalization/result-service.ts');
  const [ranking] = await db.select().from(schema.weeklyRankings).where(eq(schema.weeklyRankings.weekId, fixture.weekId));
  const [before] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, ranking.reviewId));

  await assert.rejects(() => overrideReview({ reviewId: ranking.reviewId, actorSubject: regressionAdmin, newScore: 11, reason: 'Regression: frozen week', db }), withCode('WEEK_ALREADY_FINALIZED'));
  await assert.rejects(() => rerunReview({ versionId: ranking.submissionVersionId, actorSubject: regressionAdmin, reason: 'Regression: frozen week', db }), withCode('WEEK_ALREADY_FINALIZED'));

  const [after] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, ranking.reviewId));
  assert.equal(after.finalScore, before.finalScore, 'a refused override must not move the review');
  assert.equal(after.status, before.status);
  const overrides = await db.select().from(schema.reviewOverrides).where(eq(schema.reviewOverrides.reviewId, ranking.reviewId));
  assert.equal(overrides.length, 0, 'a refused override must leave no history row');
  const [job] = await db.select().from(schema.reviewJobs).where(eq(schema.reviewJobs.submissionVersionId, ranking.submissionVersionId));
  assert.equal(job.status, 'COMPLETED', 'a refused rerun must not requeue the job');

  const result = await getArenaResult({ userId: fixture.userId, enrollmentId: fixture.enrollmentId, db });
  assert.equal(result.finalScore, Number(after.finalScore));
  assert.equal(result.pointsAwarded, ranking.pointsAwarded);
});

test('A2: once the week is closed, every submission change is refused even before the deadline', async () => {
  const [week] = await db.select().from(schema.weeks).where(eq(schema.weeks.id, fixture.weekId));
  assert.equal(week.status, 'FINALIZED');
  assert.ok(week.submissionDeadlineAt > new Date(), 'premise: the week was closed before its deadline');
  const [submission] = await db.select().from(schema.submissions).where(eq(schema.submissions.enrollmentId, fixture.enrollmentId));
  const countVersions = async () => (await db.select({ id: schema.submissionVersions.id }).from(schema.submissionVersions)
    .where(eq(schema.submissionVersions.submissionId, submission.id))).length;
  const versionsBefore = await countVersions();
  const [draftItem] = await db.select().from(schema.submissionDraftItems).where(eq(schema.submissionDraftItems.submissionId, submission.id));
  const who = { userId: fixture.userId, enrollmentId: fixture.enrollmentId };
  const attempts = {
    'patch draft': () => submissionApi.patchArenaSubmissionDraft({ ...who, input: { explanation: 'Regression: after close' } }),
    'add link': () => submissionApi.addArenaSubmissionLink({ ...who, input: { requirementId: fixture.requirementId, url: 'https://example.com/after-close' } }),
    'upload intent': () => submissionApi.createArenaUploadIntent({ ...who, input: { requirementId: fixture.requirementId, filename: 'late.csv', mimeType: 'text/csv', sizeBytes: SUBMITTED.length } }),
    'finalize upload': () => submissionApi.finalizeArenaUpload({ ...who, intentId: randomUUID() }),
    'delete item': () => submissionApi.deleteArenaSubmissionItem({ ...who, itemId: draftItem?.id ?? randomUUID() }),
    submit: () => submissionApi.submitArenaSubmission(who),
  };
  for (const [name, attempt] of Object.entries(attempts)) await assert.rejects(attempt, withCode('WEEK_CLOSED'), name);

  // FINALIZING is closed too: between close and finalize is where an open form used to slip a new attempt in.
  await db.update(schema.weeks).set({ status: 'FINALIZING' }).where(eq(schema.weeks.id, fixture.weekId));
  try {
    await assert.rejects(attempts.submit, withCode('WEEK_CLOSED'), 'submit while FINALIZING');
  } finally {
    await db.update(schema.weeks).set({ status: 'FINALIZED' }).where(eq(schema.weeks.id, fixture.weekId));
  }

  assert.equal(await countVersions(), versionsBefore, 'no version may be created after close');
  if (draftItem) {
    const [still] = await db.select().from(schema.submissionDraftItems).where(eq(schema.submissionDraftItems.id, draftItem.id));
    assert.ok(still, 'no draft item may be deleted after close');
  }
});

test('A3: a first review that failed before writing a review row is listed and can be rerun', async () => {
  const { listAdminReviews } = await import('../src/server/admin/operations.ts');
  const { rerunReview } = await import('../src/server/reviews/admin.ts');
  const [submission] = await db.select().from(schema.submissions).where(eq(schema.submissions.enrollmentId, fixture.enrollmentId));
  const [orphan] = await db.insert(schema.submissionVersions).values({
    submissionId: submission.id, versionNumber: 99, explanation: 'Regression: first review failed', submittedAt: new Date(),
    accessStatus: 'ACCESSIBLE', reviewAttemptNumber: 2, reviewStatus: 'FAILED',
  }).returning();
  await db.insert(schema.reviewJobs).values({
    submissionVersionId: orphan.id, status: 'FAILED', attemptCount: 5,
    lastErrorCode: 'REGRESSION_PROVIDER_FAILED', lastErrorMessage: 'provider gave up',
  });

  const query = { q: '', limit: 100, offset: 0 };
  const row = (await listAdminReviews(query, 'FAILED', db)).find((review) => review.versionId === orphan.id);
  assert.ok(row, 'the orphan failure must appear under FAILED');
  assert.equal(row.id, null, 'no review row exists, so there is nothing to override');
  assert.equal(row.status, 'FAILED');
  assert.equal(row.jobStatus, 'FAILED');
  assert.match(row.jobError ?? '', /REGRESSION_PROVIDER_FAILED/);
  assert.equal(row.enrollmentId, fixture.enrollmentId);
  assert.ok((await listAdminReviews(query, undefined, db)).some((review) => review.versionId === orphan.id), 'and in the unfiltered list');

  // Recovery from that row, while the week is still being resolved.
  await db.update(schema.weeks).set({ status: 'FINALIZING' }).where(eq(schema.weeks.id, fixture.weekId));
  try {
    const rerun = await rerunReview({ versionId: row.versionId, actorSubject: regressionAdmin, reason: 'Regression: recover first failure', db });
    assert.equal(rerun.nextRunNumber, 1);
    const [job] = await db.select().from(schema.reviewJobs).where(eq(schema.reviewJobs.submissionVersionId, orphan.id));
    assert.equal(job.status, 'PENDING');
    assert.equal(job.attemptCount, 0);
    const [version] = await db.select().from(schema.submissionVersions).where(eq(schema.submissionVersions.id, orphan.id));
    assert.equal(version.reviewStatus, 'QUEUED');
  } finally {
    await db.update(schema.weeks).set({ status: 'FINALIZED' }).where(eq(schema.weeks.id, fixture.weekId));
  }
});

test('A4 + flow 3: a refunded reward offers retryOf, the retry succeeds, and the fulfilment note reaches the participant', async () => {
  const { takeMilestone, getMilestoneLadder } = await import('../src/server/rewards/milestones.ts');
  const { reverseRedemption, fulfillRedemption } = await import('../src/server/rewards/redemption-service.ts');
  const { getParticipantOverview } = await import('../src/server/arena/participant-service.ts');
  const [sku] = await db.insert(schema.catalog).values({ slug: STAMP + '-retry', title: 'Regression retry reward', pointsCost: 100, rewardType: 'DIGITAL', inventoryMode: 'UNLIMITED', isActive: true }).returning();
  (fixture.auditRewardIds ??= []).push(sku.id);
  const step = async () => (await getMilestoneLadder(fixture.userId, db)).steps.find((candidate) => candidate.slug === sku.slug);

  const first = await takeMilestone({ userId: fixture.userId, slug: sku.slug, db });
  assert.equal((await step()).state, 'taken');
  await reverseRedemption({ redemptionId: first.redemptionId, actorSubject: regressionAdmin, reason: 'Regression refund 1', db });
  let current = await step();
  assert.equal(current.state, 'ready');
  assert.equal(current.retryOf, first.redemptionId);
  const second = await takeMilestone({ userId: fixture.userId, slug: sku.slug, retryOf: current.retryOf, db });
  assert.notEqual(second.redemptionId, first.redemptionId);

  // A second refund moves retryOf to the newest claim; the first already has a retry keyed to it.
  await reverseRedemption({ redemptionId: second.redemptionId, actorSubject: regressionAdmin, reason: 'Regression refund 2', db });
  current = await step();
  assert.equal(current.retryOf, second.redemptionId);
  const third = await takeMilestone({ userId: fixture.userId, slug: sku.slug, retryOf: current.retryOf, db });
  assert.equal((await step()).state, 'taken');

  // Flow 3: what the admin writes on fulfilment is what the participant receives.
  await fulfillRedemption({ redemptionId: third.redemptionId, actorSubject: regressionAdmin, reference: 'KODE-VOUCHER-REGRESSION', db });
  const history = (await getParticipantOverview(fixture.userId, db)).redemptions.filter((item) => item.slug === sku.slug);
  assert.equal(history.length, 3);
  assert.equal(history.find((item) => item.id === third.redemptionId)?.deliveryNote, 'KODE-VOUCHER-REGRESSION');
  assert.ok(history.filter((item) => item.id !== third.redemptionId).every((item) => item.deliveryNote === null), 'reversed claims deliver nothing');
});

test('A5: zero stock is out of stock on the ladder, and restocking makes it claimable again', async () => {
  const { updateAdminInventory } = await import('../src/server/admin/operations.ts');
  const { getMilestoneLadder, takeMilestone } = await import('../src/server/rewards/milestones.ts');
  const [sku] = await db.insert(schema.catalog).values({ slug: STAMP + '-empty', title: 'Regression empty stock', pointsCost: 100, rewardType: 'DIGITAL', inventoryMode: 'LIMITED', isActive: true }).returning();
  (fixture.auditRewardIds ??= []).push(sku.id);
  try {
    const period = await updateAdminInventory({ action: 'period', rewardId: sku.id, periodStart: new Date(Date.now() - 60_000).toISOString(), periodEnd: new Date(Date.now() + 3_600_000).toISOString(), quantityTotal: 0, reason: 'Regression', actorSubject: regressionAdmin, db });
    const step = async () => (await getMilestoneLadder(fixture.userId, db)).steps.find((candidate) => candidate.slug === sku.slug);
    const empty = await step();
    assert.equal(empty.state, 'out_of_stock');
    assert.equal(empty.outOfStock, true);
    await assert.rejects(() => takeMilestone({ userId: fixture.userId, slug: sku.slug, db }), /stock/i);

    await updateAdminInventory({ action: 'quantity', periodId: period.id, quantityTotal: 1, reason: 'Regression restock', actorSubject: regressionAdmin, db });
    const restocked = await step();
    assert.equal(restocked.state, 'ready');
    assert.equal(restocked.outOfStock, false);
  } finally {
    await db.delete(schema.inventoryPeriods).where(eq(schema.inventoryPeriods.rewardId, sku.id));
  }
});

test('A6: preparing a future draft week does not displace the monitored week in the admin overview', async () => {
  const { getOpsOverview } = await import('../src/server/admin/overview.ts');
  const { getCurrentArenaWeek } = await import('../src/server/arena/project-service.ts');
  const [future] = await db.insert(schema.weeks).values({ weekCode: STAMP + '-future', title: 'Regression future draft', status: 'DRAFT', opensAt: new Date('2099-01-01T00:00:00Z'), submissionDeadlineAt: new Date('2099-01-06T00:00:00Z'), timezone: 'Asia/Jakarta' }).returning();
  try {
    const overview = await getOpsOverview(db);
    const current = await getCurrentArenaWeek().catch((error) => { if (error?.code === 'WEEK_NOT_FOUND') return null; throw error; });
    assert.notEqual(overview.week?.id, future.id, 'a draft must not become the monitored week');
    if (current) assert.equal(overview.week?.id, current.id, 'admin and participant must look at the same week');
  } finally {
    await db.delete(schema.weeks).where(eq(schema.weeks.id, future.id));
  }
});

test('Flow 2: a division freezes its base rubric once — at creation or later — and an unsatisfiable one is refused', async () => {
  const { createAdminDivision, updateAdminDivision, listAdminDivisions } = await import('../src/server/admin/content.ts');
  const rubric = [{ name: 'Regression clarity', weight: 60, maxScore: 100 }, { name: 'Regression depth', weight: 40, maxScore: 100 }];
  const listed = async (id) => (await listAdminDivisions(db)).find((division) => division.id === id);
  fixture.auditDivisionIds ??= [];

  const division = await createAdminDivision({ slug: STAMP + '-rubric', name: 'Regression rubric division', description: null, isActive: false, sortOrder: 9998, baseRubric: rubric, actorSubject: regressionAdmin, db });
  fixture.auditDivisionIds.push(division.id);
  assert.equal((await listed(division.id)).hasBaseRubric, true);
  assert.deepEqual((await listed(division.id)).baseRubric, rubric);
  await assert.rejects(() => updateAdminDivision({ divisionId: division.id, baseRubric: [{ name: 'Replacement', weight: 1, maxScore: 100 }], actorSubject: regressionAdmin, db }), withCode('VALIDATION_ERROR'));
  assert.deepEqual((await listed(division.id)).baseRubric, rubric, 'the first freeze stays authoritative');

  const bare = await createAdminDivision({ slug: STAMP + '-bare', name: 'Regression bare division', description: null, isActive: false, sortOrder: 9997, actorSubject: regressionAdmin, db });
  fixture.auditDivisionIds.push(bare.id);
  assert.equal((await listed(bare.id)).hasBaseRubric, false);
  await updateAdminDivision({ divisionId: bare.id, baseRubric: rubric, actorSubject: regressionAdmin, db });
  assert.equal((await listed(bare.id)).hasBaseRubric, true);

  // A service caller that skips the route schema still cannot freeze a rubric no package could satisfy, and the division is not left behind.
  const badSlug = STAMP + '-unsatisfiable';
  await assert.rejects(() => createAdminDivision({ slug: badSlug, name: 'Regression unsatisfiable', description: null, isActive: false, sortOrder: 9996, baseRubric: [{ name: 'Same', weight: 1, maxScore: 100 }, { name: 'same', weight: 1, maxScore: 100 }], actorSubject: regressionAdmin, db }), withCode('VALIDATION_ERROR'));
  const [ghost] = await db.select().from(schema.divisions).where(eq(schema.divisions.slug, badSlug));
  if (ghost) fixture.auditDivisionIds.push(ghost.id);
  assert.equal(ghost, undefined, 'a refused freeze must roll the division back');
});

// ---- 2026-09-11 brief: voucher delivery, skill attribution, job sources, career report

test('T1: a voucher claim is delivered when the main site accepts the code, and left for manual fulfilment when it cannot', async () => {
  const { and } = await import('drizzle-orm');
  const { takeMilestone } = await import('../src/server/rewards/milestones.ts');
  const { deliverVoucherReward, voucherCodeFor } = await import('../src/server/rewards/voucher-push.ts');
  const [sku] = await db.insert(schema.catalog).values({ slug: STAMP + '-voucher', title: 'Regression voucher', pointsCost: 50, rewardType: 'DISCOUNT', inventoryMode: 'UNLIMITED', isActive: true }).returning();
  (fixture.auditRewardIds ??= []).push(sku.id);
  const claim = async () => (await db.select().from(schema.redemptions).where(eq(schema.redemptions.id, taken.redemptionId)))[0];

  // The sandbox blanks MAIN_SITE_*: the contract is not configured.
  const taken = await takeMilestone({ userId: fixture.userId, slug: sku.slug, db });
  assert.equal(taken.delivery && taken.delivery.status, 'MANUAL_REQUIRED');
  assert.equal((await claim()).status, 'PENDING', 'an undeliverable voucher never cancels a paid claim');
  const deferred = await db.select().from(schema.logs).where(and(eq(schema.logs.entityId, taken.redemptionId), eq(schema.logs.action, 'REWARD_VOUCHER_PUSH_DEFERRED')));
  assert.equal(deferred.length, 1, 'the manual-fulfilment state is recorded for the admin queue');

  const saved = { origin: process.env.MAIN_SITE_ORIGIN, token: process.env.MAIN_SITE_VOUCHER_TOKEN };
  process.env.MAIN_SITE_ORIGIN = 'https://main.example.test';
  process.env.MAIN_SITE_VOUCHER_TOKEN = 'regression-token';
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), auth: init.headers.Authorization });
    return new Response('{}', { status: 201 });
  };
  try {
    const delivered = await deliverVoucherReward({ redemptionId: taken.redemptionId, fetcher, db });
    assert.equal(delivered.status, 'DELIVERED');
    assert.equal(delivered.code, voucherCodeFor(taken.redemptionId));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://main.example.test/api/v1/vouchers');
    assert.equal(calls[0].auth, 'Bearer regression-token');
    assert.equal(calls[0].body.code, delivered.code);
    assert.equal(calls[0].body.external_reference, taken.redemptionId);
    const fulfilled = await claim();
    assert.equal(fulfilled.status, 'FULFILLED');
    assert.ok(fulfilled.fulfillmentReference.includes(delivered.code), 'the participant reads the code as the delivery note');
    const again = await deliverVoucherReward({ redemptionId: taken.redemptionId, fetcher, db });
    assert.equal(again.status, 'ALREADY_SETTLED');
    assert.equal(calls.length, 1, 'a settled claim is never pushed twice');
  } finally {
    process.env.MAIN_SITE_ORIGIN = saved.origin ?? '';
    process.env.MAIN_SITE_VOUCHER_TOKEN = saved.token ?? '';
  }
});

test('T2: a live project maps rubric criteria to skills until its week is finalized, and finalization reads the mapping', async () => {
  const { attributeProjectCriteria } = await import('../src/server/admin/content.ts');
  const { attributeSkillEvidence } = await import('../src/server/finalization/skill-attribution.ts');
  const criteria = await db.select().from(schema.projectRubricCriteria).where(eq(schema.projectRubricCriteria.projectId, fixture.projectId));
  const toSkill = criteria.map((criterion) => ({ criterionId: criterion.id, skillId: fixture.skillId }));
  const input = (attributions) => ({ projectId: fixture.projectId, reason: 'Regression: map criteria', attributions, actorSubject: regressionAdmin, db });

  await assert.rejects(() => attributeProjectCriteria(input(toSkill)), withCode('WEEK_ALREADY_FINALIZED'), 'evidence already written is never re-attributed');

  await db.update(schema.weeks).set({ status: 'FINALIZING' }).where(eq(schema.weeks.id, fixture.weekId));
  try {
    const [stranger] = await db.insert(schema.skills).values({ slug: STAMP + '-stranger', name: STAMP + ' Stranger' }).returning();
    try {
      await assert.rejects(() => attributeProjectCriteria(input([{ criterionId: criteria[0].id, skillId: stranger.id }])), withCode('VALIDATION_ERROR'), 'a criterion may only measure a skill the project lists');
    } finally {
      await db.delete(schema.skills).where(eq(schema.skills.id, stranger.id));
    }

    const mappedResult = await attributeProjectCriteria(input(toSkill));
    assert.equal(mappedResult.changed, criteria.length);
    assert.equal((await attributeProjectCriteria(input(toSkill))).changed, 0, 'saving the same mapping changes nothing');

    // What finalization computes from the stored mapping and the stored review.
    const [ranking] = await db.select().from(schema.weeklyRankings).where(eq(schema.weeklyRankings.weekId, fixture.weekId));
    const mapped = await db.select().from(schema.projectRubricCriteria).where(eq(schema.projectRubricCriteria.projectId, fixture.projectId));
    const scores = await db.select().from(schema.reviewScores).where(eq(schema.reviewScores.reviewId, ranking.reviewId));
    const [evidence] = attributeSkillEvidence({
      projectSkills: [fixture.skillId],
      criteria: mapped.map((criterion) => ({ id: criterion.id, skillId: criterion.skillId, weight: Number(criterion.weight), maxScore: Number(criterion.maxScore) })),
      scores: scores.map((score) => ({ rubricCriterionId: score.rubricCriterionId, rawScore: Number(score.rawScore), maxScore: Number(score.maxScore) })),
      projectScore: Number(ranking.finalScore),
    });
    assert.equal(evidence.attribution, 'CRITERION', 'the skill is measured by its criteria, not stood in for by the project score');
    assert.ok(evidence.criterionCount >= 1);

    await attributeProjectCriteria(input(criteria.map((criterion) => ({ criterionId: criterion.id, skillId: null }))));
  } finally {
    await db.update(schema.weeks).set({ status: 'FINALIZED' }).where(eq(schema.weeks.id, fixture.weekId));
  }
});

test('T3: an admin registers a jobs feed from the console; a broken field map, taken slug or plaintext feed is refused', async () => {
  const { createAdminJobSource } = await import('../src/server/admin/operations.ts');
  fixture.auditJobSourceIds ??= [];
  const base = {
    name: STAMP + ' Feed', adapter: 'http-json', feedUrl: 'https://jobs.example.test/v1/jobs', siteUrl: 'https://jobs.example.test',
    category: 'Teknologi', itemsPath: 'data.jobs', fieldMap: { externalId: 'id', title: 'title', company: 'company.name', applicationUrl: 'url' },
    syncIntervalMinutes: 360, stalenessDays: 7, activate: false, reason: 'Regression: register feed', actorSubject: regressionAdmin, db,
  };
  const created = await createAdminJobSource(base);
  fixture.auditJobSourceIds.push(created.id);
  const [row] = await db.select().from(schema.jobSources).where(eq(schema.jobSources.id, created.id));
  assert.equal(row.adapter, 'http-json');
  assert.equal(row.isActive, false);
  assert.equal(row.config.baseUrl, base.feedUrl);
  assert.equal(row.config.fieldMap.company, 'company.name');
  assert.equal(row.config.category, 'Teknologi');
  assert.equal(row.credentialEnvVar, null);

  const second = await createAdminJobSource(base);
  fixture.auditJobSourceIds.push(second.id);
  assert.notEqual(second.slug, created.slug, 'the same name gets its own slug, never an overwrite');
  await assert.rejects(() => createAdminJobSource({ ...base, slug: created.slug }), withCode('VALIDATION_ERROR'));
  await assert.rejects(() => createAdminJobSource({ ...base, fieldMap: { ...base.fieldMap, company: '' } }), withCode('VALIDATION_ERROR'));
  await assert.rejects(() => createAdminJobSource({ ...base, feedUrl: 'http://jobs.example.test/v1/jobs' }), withCode('VALIDATION_ERROR'));

  const privateFeed = await createAdminJobSource({ ...base, name: STAMP + ' Private', credentialEnvVar: 'REGRESSION_FEED_TOKEN' });
  fixture.auditJobSourceIds.push(privateFeed.id);
  const [privateRow] = await db.select().from(schema.jobSources).where(eq(schema.jobSources.id, privateFeed.id));
  assert.equal(privateRow.credentialEnvVar, 'REGRESSION_FEED_TOKEN', 'the credential is referenced by name');
  assert.equal(privateRow.config.authHeader, 'Authorization');
  assert.equal(privateFeed.credentialConfigured, false);
});

test('T4: the admin Career Report summary matches what the participant sees, and a preview is audited', async () => {
  const { and } = await import('drizzle-orm');
  const { listAdminCareerReports, previewAdminCareerReport } = await import('../src/server/admin/career-report.ts');
  const { getCareerReport } = await import('../src/server/career/report-service.ts');
  const rows = await listAdminCareerReports({ q: STAMP, limit: 25, offset: 0 }, db);
  const mine = rows.find((row) => row.id === fixture.userId);
  assert.ok(mine, 'a participant with an enrollment is listed');
  const report = await getCareerReport(fixture.userId, db);
  assert.equal(mine.projectsCompleted, report.projectsCompleted);
  assert.ok(mine.projectsCompleted >= 1);
  assert.equal(mine.averageScore, report.averageScore);
  assert.equal(mine.points.balance, report.points.balance);
  assert.equal(mine.cv, null);

  const preview = await previewAdminCareerReport({ userId: fixture.userId, actorSubject: regressionAdmin, db });
  assert.equal(preview.user.id, fixture.userId);
  assert.equal(preview.report.projectsCompleted, report.projectsCompleted);
  assert.equal(preview.report.averageScore, report.averageScore);
  const views = await db.select().from(schema.logs).where(and(eq(schema.logs.entityId, fixture.userId), eq(schema.logs.action, 'CAREER_REPORT_VIEWED')));
  assert.equal(views.length, 1);
  assert.equal(views[0].actorSubject, regressionAdmin);
});
`;

try {
  writeFileSync(target, source, { flag: 'wx' });
  const result = spawnSync(process.execPath, ['--import', './scripts/node-test-hooks.mjs', '--test', '--test-force-exit', fileURLToPath(target)], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  unlinkSync(target);
}
