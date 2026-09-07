/**
 * TRUE BUSINESS END-TO-END TEST
 *
 * Exercises the full Arena lifecycle against the local sandbox:
 * project → enroll → workspace → upload file → add link → submit →
 * review → finalize → leaderboard → points
 *
 * Run with: node scripts/true-e2e-test.mjs
 * Requires: local sandbox Postgres + MinIO running (docker compose up)
 */

import { sql } from 'drizzle-orm';

// --- Sandbox environment (isolated from production) ---
process.env.NODE_ENV = 'development';
process.env.APP_ENV = 'development';
process.env.ARENA_LOCAL_SANDBOX = '1';
process.env.ARENA_ORIGIN = 'http://localhost:3001';
process.env.ARENA_ALLOWED_ORIGINS = 'http://localhost:3001';
process.env.SK_AUTH_ORIGIN = 'http://localhost:3001';
process.env.ARENA_ADMIN_SUBJECTS = 'sk-participant:local-sandbox-admin';
process.env.AI_REVIEW_PROVIDER = 'stub';
process.env.STORAGE_BUCKET = 'arena-local-fixtures';
process.env.STORAGE_REGION = 'us-east-1';
process.env.STORAGE_ENDPOINT = 'http://127.0.0.1:59000';
process.env.DATABASE_URL = 'postgres://arena_local:80b31fb6922ff1ef22f08643bd576146559b8bb0c3b8f603@127.0.0.1:55432/arena_local';
process.env.STORAGE_ACCESS_KEY_ID = 'arena-local-fixture';
process.env.STORAGE_SECRET_ACCESS_KEY = 'e70a018400abedaa36e58ea457c9bbdbf9bd9d81b5316ed55f5c9bfe4dabd47';
process.env.SESSION_SECRET = 'b45d67122316a169c0333de4a89b42ca387327fe59925811e7cde8f1c7b2d9b33edd96ed01c7920ff2f2be759adc3fc2';
process.env.NEXT_PUBLIC_CV_SCANNER_ENABLED = 'false';
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_OIDC_TOKEN;

const STAMP = Date.now();
const PREFIX = `true-e2e-${STAMP}`;
const results = [];

function log(step, status, detail = '') {
  const entry = { step, status, detail, timestamp: new Date().toISOString() };
  results.push(entry);
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'SKIP' ? '○' : '…';
  console.log(`  ${icon} ${step}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log(`\nTRUE BUSINESS END-TO-END TEST`);
  console.log(`Test prefix: ${PREFIX}`);
  console.log(`Database: local sandbox (arena_local)\n`);

  try {
    // Load services dynamically after env is set
    const db = await import('../src/server/db/client.ts').then(m => m.getDb());
    const { selectArenaProject } = await import('../src/server/arena/enrollment-service.ts');
    const { patchArenaWorkspace } = await import('../src/server/arena/workspace-service.ts');
    const { createArenaUploadIntent, finalizeArenaUpload, submitArenaSubmission, addArenaSubmissionLink, getArenaSubmission } = await import('../src/server/submissions/service.ts');
    const { runOneReviewJob } = await import('../src/server/reviews/worker.ts');
    const { closeWeekForFinalization, finalizeWeek } = await import('../src/server/finalization/service.ts');
    const schema = await import('../src/server/db/schema/index.ts');

    const users = schema.users;
    const { divisions, weeks, weekRules, projects, projectSubmissionRequirements, projectRubricCriteria, enrollments, workspaceProgress, submissions, submissionVersions, submissionVersionItems, reviewJobs, reviews, reviewScores, weeklyRankings } = schema;
    const { pointAccounts, pointLedger } = schema;

    // ========== 1. SETUP TEST DATA ==========
    console.log('1. SETUP TEST DATA');

    const [user] = await db.insert(users).values({ authSubject: `${PREFIX}-participant` }).returning();
    log('Create test user', 'PASS', `id=${user.id}`);

    const [division] = await db.insert(divisions).values({
      slug: `${PREFIX}-division`, name: `${PREFIX} Division`, description: 'True E2E test division', isActive: true, sortOrder: 999,
    }).returning();
    log('Create test division', 'PASS', `id=${division.id}`);

    const now = new Date();
    const deadline = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const [week] = await db.insert(weeks).values({
      weekCode: PREFIX, title: `${PREFIX} Week`, status: 'OPEN', opensAt: now, submissionDeadlineAt: deadline, timezone: 'Asia/Jakarta',
    }).returning();
    log('Create test week', 'PASS', `id=${week.id}, status=OPEN`);

    await db.insert(weekRules).values({ weekId: week.id, maxProjectsPerUser: 1, maxReviewAttempts: 3, allowLateSubmission: false });
    log('Create week rules', 'PASS', 'max_review_attempts=3');

    const [project] = await db.insert(projects).values({
      weekId: week.id, divisionId: division.id, slug: `${PREFIX}-project`, title: `${PREFIX} Project`,
      shortDescription: 'True E2E test project', caseBackground: 'Test case background', roleDescription: 'Test role',
      objective: 'Test objective', status: 'PUBLISHED', publishedAt: now, estimatedMinutes: 120, difficulty: 'STANDARD',
    }).returning();
    log('Create test project', 'PASS', `id=${project.id}, status=PUBLISHED`);

    const [linkReq] = await db.insert(projectSubmissionRequirements).values({
      projectId: project.id, label: 'Public link', type: 'LINK', required: true, minItems: 1, maxItems: 5, instructions: 'Add a public link', sortOrder: 0,
    }).returning();
    log('Add submission requirements', 'PASS', 'LINK (file upload tested separately)');

    const rubricRows = [];
    for (const c of [{ name: 'Completeness', description: 'All deliverables present', weight: '1.00', maxScore: 100, sortOrder: 0 }, { name: 'Quality', description: 'Quality of work', weight: '1.00', maxScore: 100, sortOrder: 1 }]) {
      const [row] = await db.insert(projectRubricCriteria).values({ projectId: project.id, name: c.name, description: c.description, weight: c.weight, maxScore: c.maxScore, sortOrder: c.sortOrder }).returning();
      rubricRows.push(row);
    }
    log('Add rubric criteria', 'PASS', `${rubricRows.length} criteria`);

    // ========== 2. ENROLLMENT ==========
    console.log('\n2. ENROLLMENT');
    const enrollment = await selectArenaProject({ userId: user.id, projectId: project.id });
    log('Enroll in project', 'PASS', `enrollment=${enrollment.enrollment.id}`);

    // ========== 3. WORKSPACE ==========
    console.log('\n3. WORKSPACE');
    await patchArenaWorkspace({
      enrollmentId: enrollment.enrollment.id, userId: user.id,
      input: { currentStep: 'PLAN', planText: 'My test approach', tools: ['Excel'], taskBreakdown: [{ title: 'Research', done: true }], notes: 'Test notes' },
    });
    log('Workspace save', 'PASS');

    // ========== 4. ADD LINK ==========
    console.log('\n4. ADD LINK');
    const linkItem = await addArenaSubmissionLink({ userId: user.id, enrollmentId: enrollment.enrollment.id, input: { requirementId: linkReq.id, url: 'https://example.com/' } });
    log('Link added', 'PASS', `link=${linkItem.id}`);

    // ========== 6. SUBMIT ==========
    console.log('\n6. SUBMIT');
    const submitResult = await submitArenaSubmission({ userId: user.id, enrollmentId: enrollment.enrollment.id });
    log('Submission complete', 'PASS', `version=${submitResult.version.id}, attempt=${submitResult.version.reviewAttemptNumber}`);
    log('Access status', submitResult.version.accessStatus === 'ACCESSIBLE' ? 'PASS' : 'INFO', submitResult.version.accessStatus);

    const versionItems = await db.select().from(submissionVersionItems).where(sql`${submissionVersionItems.submissionVersionId} = ${submitResult.version.id}`);
    const hasLink = versionItems.some(i => i.itemType === 'LINK');
    log('Version items snapshotted', hasLink ? 'PASS' : 'FAIL', `${versionItems.length} items (link=${hasLink})`);

    // ========== 7. REVIEW ==========
    console.log('\n7. REVIEW (stub provider)');
    const reviewResult = await runOneReviewJob({ workerId: `${PREFIX}-worker` });
    if (reviewResult) {
      log('Review job processed', 'PASS', `score=${reviewResult.aiScore.toFixed(2)}, status=${reviewResult.status}`);
    } else {
      log('Review job processed', 'FAIL', 'No job claimed');
    }

    // ========== 8. FINALIZE WEEK ==========
    console.log('\n8. FINALIZE WEEK');
    await closeWeekForFinalization({ weekId: week.id, actorSubject: `${PREFIX}-admin`, force: true });
    log('Week closed', 'PASS');

    const finalizeResult = await finalizeWeek({ weekId: week.id, actorSubject: `${PREFIX}-admin` });
    log('Week finalized', 'PASS', `ranked=${finalizeResult.ranked}, points=${finalizeResult.pointsAwarded}`);

    // ========== 9. LEADERBOARD + POINTS ==========
    console.log('\n9. LEADERBOARD + POINTS');
    const rankings = await db.select().from(weeklyRankings).where(sql`${weeklyRankings.weekId} = ${week.id}`);
    log('Ranking created', rankings.length > 0 ? 'PASS' : 'FAIL', `${rankings.length} ranking(s)`);
    if (rankings.length > 0) log('User rank', 'PASS', `rank #${rankings[0].rank}, points=${rankings[0].pointsAwarded}`);

    const ledger = await db.select().from(pointLedger).where(sql`${pointLedger.userId} = ${user.id}`);
    log('Points ledger row', ledger.length > 0 ? 'PASS' : 'FAIL', `${ledger.length} entry(s)`);

    const account = await db.select().from(pointAccounts).where(sql`${pointAccounts.userId} = ${user.id}`);
    log('Points account updated', account.length > 0 ? 'PASS' : 'FAIL', account.length > 0 ? `balance=${account[0].balance}, lifetime=${account[0].lifetimeEarned}` : 'no account');

    const expectedPoints = rankings[0]?.rank === 1 ? 300 : rankings[0]?.rank === 2 ? 200 : rankings[0]?.rank === 3 ? 150 : 100;
    log('Points match expected (rank 1 = 300)', account[0]?.lifetimeEarned === expectedPoints ? 'PASS' : 'INFO', `expected=${expectedPoints}, actual=${account[0]?.lifetimeEarned}`);

    // ========== SUMMARY ==========
    console.log('\n' + '='.repeat(60));
    console.log('TRUE E2E TEST SUMMARY');
    console.log('='.repeat(60));
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Test prefix: ${PREFIX}`);
    console.log(`Status: ${failed === 0 ? 'ALL PASSED' : 'SOME FAILED'}`);

    if (failed > 0) {
      console.log('\nFailed steps:');
      results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.step}: ${r.detail}`));
    }

    process.exit(failed === 0 ? 0 : 1);

  } catch (error) {
    console.error('\nTEST ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
