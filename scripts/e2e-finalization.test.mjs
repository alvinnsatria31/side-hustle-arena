import assert from "node:assert/strict";
import test from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

assert.equal(process.env.APP_ENV, "development", "Finalization E2E requires APP_ENV=development");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

// Service modules resolve through scripts/node-test-hooks.mjs
// (`test:e2e:finalize` wires `--import`). They exercise the real Neon dev DB.
const enrollmentApi = await import("../src/server/arena/enrollment-service.ts");
const submissionApi = await import("../src/server/submissions/service.ts");
const worker = await import("../src/server/reviews/worker.ts");
const finalization = await import("../src/server/finalization/service.ts");
const leaderboard = await import("../src/server/finalization/leaderboard-service.ts");
const notifications = await import("../src/server/notifications/service.ts");
const adminOps = await import("../src/server/admin/overview.ts");
const milestones = await import("../src/server/rewards/milestones.ts");
const voucher = await import("../src/server/rewards/voucher-push.ts");

const stamp = Date.now();
const WEEK_CODE = `E2E-FIN-${stamp}`;
const MILE_SLUG = `e2e-mile-150-${stamp}`;
const DIVISION_SLUG = `e2e-fin-div-${stamp}`;
const PROJECT_SLUG = `e2e-fin-project-${stamp}`;
const PARTICIPANTS = ["alpha", "bravo", "charlie"];

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const userIds = new Map();
let weekId;
let projectId;
let requirementId;

async function setup() {
  for (const name of PARTICIPANTS) {
    const [user] = await sql`insert into identity.users (auth_subject) values (${`e2e-fin-${stamp}-${name}`}) returning id`;
    userIds.set(name, user.id);
  }
  const now = new Date();
  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${WEEK_CODE}, 'E2E Finalization Week', 'OPEN', ${new Date(now.getTime() - 5 * 60_000)}, ${new Date(now.getTime() + 2 * 60 * 60_000)}, 'Asia/Jakarta')
    returning id`;
  weekId = week.id;
  await sql`insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission) values (${week.id}, 1, 3, false)`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, description, is_active, sort_order)
    values (${DIVISION_SLUG}, 'E2E Fin Division', 'Finalization E2E fixture', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at)
    values (${week.id}, ${division.id}, ${PROJECT_SLUG}, 'E2E Fin Project', 'Finalization E2E fixture', 'PUBLISHED', ${now}) returning id`;
  projectId = project.id;
  await sql`insert into arena.project_rubric_criteria (project_id, name, weight, max_score, sort_order) values (${project.id}, 'Execution', 1, 100, 0)`;
  const [requirement] = await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Public work link', 'LINK', true, 1, 1, 'Share a reviewer-accessible link.', 0) returning id`;
  requirementId = requirement.id;
  // Reachable milestone fixture: must exist BEFORE finalize so the crossing
  // check sees it when awards land.
  await sql`
    insert into rewards.catalog (slug, title, description, points_cost, reward_type, inventory_mode, is_active)
    values (${MILE_SLUG}, 'E2E Test Reward', 'Milestone E2E fixture', 150, 'DIGITAL', 'UNLIMITED', true)`;
}

async function cleanup() {
  // Rankings + ledger reference reviews/versions: delete them first.
  await sql`delete from arena.weekly_rankings where week_id = ${weekId}`;
  await sql`delete from rewards.point_ledger where week_id = ${weekId}`;
  // Inbox events (submit/finalize triggers) reference nothing: clear per week.
  await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where week_id = ${weekId})`;
  await sql`delete from notifications.events where week_id = ${weekId}`;
  await sql`delete from audit.logs where entity_type = 'feature_flag' and entity_id = 'arena-publish'`;
  // Milestone take fixtures (redemptions + temp SKU) reference users/catalog.
  await sql`delete from rewards.redemptions where user_id in (select user_id from arena.enrollments where week_id = ${weekId})`;
  await sql`delete from rewards.catalog where slug = ${MILE_SLUG}`;
  const enrollments = await sql`select id from arena.enrollments where week_id = ${weekId}`;
  for (const enrollment of enrollments) {
    const submissions = await sql`select id from arena.submissions where enrollment_id = ${enrollment.id}`;
    for (const submission of submissions) {
      const versions = await sql`select id from arena.submission_versions where submission_id = ${submission.id}`;
      for (const version of versions) {
        const fetchedReviews = await sql`select id from arena.reviews where submission_version_id = ${version.id}`;
        for (const review of fetchedReviews) {
          await sql`delete from arena.review_scores where review_id = ${review.id}`;
          await sql`delete from arena.review_overrides where review_id = ${review.id}`;
          await sql`delete from audit.logs where entity_id = ${review.id}`;
        }
        await sql`delete from arena.reviews where submission_version_id = ${version.id}`;
        await sql`delete from arena.review_jobs where submission_version_id = ${version.id}`;
        await sql`delete from audit.logs where entity_id = ${version.id}`;
        await sql`delete from arena.submission_version_items where submission_version_id = ${version.id}`;
      }
      await sql`delete from arena.submission_versions where submission_id = ${submission.id}`;
      await sql`delete from arena.submission_draft_items where submission_id = ${submission.id}`;
      await sql`delete from arena.upload_intents where submission_id = ${submission.id}`;
      await sql`delete from arena.submissions where id = ${submission.id}`;
    }
    await sql`delete from arena.workspace_progress where enrollment_id = ${enrollment.id}`;
    await sql`delete from audit.logs where entity_id = ${enrollment.id}`;
    await sql`delete from arena.enrollments where id = ${enrollment.id}`;
  }
  await sql`delete from audit.logs where entity_id = ${weekId}`;
  await sql`delete from arena.project_submission_requirements where project_id = ${projectId}`;
  await sql`delete from arena.project_rubric_criteria where project_id = ${projectId}`;
  await sql`delete from arena.projects where id = ${projectId}`;
  await sql`delete from arena.divisions where slug = ${DIVISION_SLUG}`;
  await sql`delete from arena.week_rules where week_id = ${weekId}`;
  await sql`delete from arena.weeks where id = ${weekId}`;
  for (const userId of userIds.values()) {
    await sql`delete from rewards.point_accounts where user_id = ${userId}`;
    await sql`delete from identity.users where id = ${userId}`;
  }
}

test("end-to-end finalization: 3 racers → close → finalize → ranks/points/ledger → idempotent → void+reversal", async (t) => {
  await setup();
  t.after(async () => {
    await cleanup();
    await sql.end({ timeout: 5 });
  });

  // Three participants submit the same project (stub scores tie → time breaks it).
  const enrollmentIds = new Map();
  for (const name of PARTICIPANTS) {
    const userId = userIds.get(name);
    const selection = await enrollmentApi.selectArenaProject({ userId, projectId });
    enrollmentIds.set(name, selection.enrollment.id);
    await submissionApi.patchArenaSubmissionDraft({ userId, enrollmentId: selection.enrollment.id, input: { explanation: `${name} work` } });
    await submissionApi.addArenaSubmissionLink({ userId, enrollmentId: selection.enrollment.id, input: { requirementId, url: "https://example.com/" } });
    const submitted = await submissionApi.submitArenaSubmission({ userId, enrollmentId: selection.enrollment.id });
    assert.equal(submitted.version.accessStatus, "ACCESSIBLE");
  }

  // Finalize refuses while review jobs are still open.
  await finalization.closeWeekForFinalization({ weekId, actorSubject: "e2e-admin", force: true });
  await assert.rejects(
    () => finalization.finalizeWeek({ weekId, actorSubject: "e2e-admin" }),
    (error) => error?.code === "WEEK_NOT_READY",
  );

  // Drain the queue with the local stub worker, then finalize.
  let completed = 0;
  while (await worker.runOneReviewJob({})) completed += 1;
  assert.equal(completed, 3);
  const result = await finalization.finalizeWeek({ weekId, actorSubject: "e2e-admin" });
  assert.equal(result.ranked, 3);
  assert.equal(result.pointsAwarded, 650);

  const board = await leaderboard.listWeekLeaderboard({ weekCode: WEEK_CODE });
  assert.equal(board.rows.length, 3);
  assert.deepEqual(board.rows.map((row) => row.rank), [1, 2, 3]);
  assert.deepEqual(board.rows.map((row) => row.pointsAwarded), [300, 200, 150]);
  assert.ok(board.rows[0].finalScore >= board.rows[1].finalScore);
  assert.ok(board.rows.every((row) => row.projectTitle === "E2E Fin Project"));

  const ledger = await sql`select user_id, amount, entry_type from rewards.point_ledger where week_id = ${weekId} order by amount desc`;
  assert.deepEqual(ledger.map((row) => row.amount), [300, 200, 150]);
  assert.ok(ledger.every((row) => row.entry_type === "WEEKLY_RANK"));
  for (const userId of userIds.values()) {
    const account = await sql`select balance, lifetime_earned from rewards.point_accounts where user_id = ${userId}`;
    assert.equal(account.length, 1);
  }
  const balances = await sql`
    select a.balance from rewards.point_accounts a
    join arena.enrollments e on e.user_id = a.user_id
    where e.week_id = ${weekId} order by a.balance desc`;
  assert.deepEqual(balances.map((row) => row.balance), [300, 200, 150]);

  // Re-finalize is idempotent: same ranks, no duplicate ledger rows.
  const repeat = await finalization.finalizeWeek({ weekId, actorSubject: "e2e-admin" });
  assert.equal(repeat.ranked, 3);
  assert.equal(repeat.pointsAwarded, 650);
  const ledgerCount = await sql`select count(*)::int as n from rewards.point_ledger where week_id = ${weekId}`;
  assert.equal(ledgerCount[0].n, 3);

  // Inbox: every racer got RESULT_READY + POINTS_AWARDED; unread counts work.
  for (const userId of userIds.values()) {
    const inbox = await notifications.listUserNotifications(userId, {});
    const types = new Set(inbox.map((item) => item.type));
    assert.ok(types.has("SUBMISSION_RECEIVED"), "submit trigger missing");
    assert.ok(types.has("RESULT_READY"), "result trigger missing");
    assert.ok(types.has("POINTS_AWARDED"), "points trigger missing");
    assert.equal(await notifications.getUnreadCount(userId), inbox.length);
    const read = await notifications.markAllNotificationsRead(userId);
    assert.equal(read.marked, inbox.length);
    assert.equal(await notifications.getUnreadCount(userId), 0);
  }

  // Admin: overview reflects the finalized week; flag flips are audited.
  const overview = await adminOps.getOpsOverview();
  assert.equal(overview.week.weekCode, WEEK_CODE);
  assert.equal(overview.week.status, "FINALIZED");
  assert.equal(overview.enrollments, 3);
  assert.equal(overview.flags.length, 4);
  assert.ok(overview.catalog.active >= 1, "seeded catalog SKU missing from overview");
  const flagSet = await adminOps.setArenaFeatureFlag({ key: "arena-publish", closed: true, message: "E2E freeze", actorSubject: "e2e-admin" });
  assert.deepEqual(flagSet, { key: "arena-publish", closed: true });
  const flagAudit = await sql`select action from audit.logs where entity_type = 'feature_flag' and entity_id = 'arena-publish'`;
  assert.ok(flagAudit.some((row) => row.action === "FEATURE_FLAG_SET"));
  await adminOps.setArenaFeatureFlag({ key: "arena-publish", closed: false, message: null, actorSubject: "e2e-admin" });
  await assert.rejects(
    () => adminOps.setArenaFeatureFlag({ key: "nope", closed: true, actorSubject: "e2e-admin" }),
    (error) => error?.code === "VALIDATION_ERROR",
  );

  // Milestones (full VPS-port loop): the pre-seeded reachable SKU makes the
  // ladder ready, the nudge fired on crossing, take claims, double-take refuses.
  const mileEvents = await sql`select user_id from notifications.events where week_id = ${weekId} and type = 'MILESTONE_REACHED'`;
  assert.equal(mileEvents.length, 3);
  const takerId = (await sql`select user_id from arena.weekly_rankings where week_id = ${weekId} order by rank asc`)[0].user_id;
  const ladder = await milestones.getMilestoneLadder(takerId);
  assert.ok(ladder.steps.some((step) => step.slug === MILE_SLUG && step.state === "ready"));
  assert.ok(ladder.steps.some((step) => step.slug === "usd-20-cash" && step.state === "locked"));
  const taken = await milestones.takeMilestone({ userId: takerId, slug: MILE_SLUG, weekId });
  assert.ok(taken.redemptionId);
  const ladderAfter = await milestones.getMilestoneLadder(takerId);
  assert.ok(ladderAfter.steps.some((step) => step.slug === MILE_SLUG && step.state === "taken"));
  await assert.rejects(
    () => milestones.takeMilestone({ userId: takerId, slug: MILE_SLUG, weekId }),
    (error) => error?.code === "VALIDATION_ERROR",
  );
  await assert.rejects(
    () => milestones.takeMilestone({ userId: takerId, slug: "usd-20-cash", weekId }),
    (error) => error?.code === "VALIDATION_ERROR",
  );
  // Voucher push without the main-site contract reports pending, never throws.
  const push = await voucher.pushRewardCode(taken.redemptionId);
  assert.equal(push.pushable, false);

  // Void the 3rd-place finisher: ranking row gone, points revoked, score preserved.
  const rankedRows = await sql`select user_id, final_score from arena.weekly_rankings where week_id = ${weekId} order by rank asc`;
  const thirdUserId = rankedRows[2].user_id;
  const thirdEnrollment = await sql`select id from arena.enrollments where week_id = ${weekId} and user_id = ${thirdUserId}`;
  const voided = await finalization.voidEnrollment({ enrollmentId: thirdEnrollment[0].id, actorSubject: "e2e-admin", reason: "E2E plagiarism check" });
  assert.equal(voided.pointsRevoked, 150);

  const boardAfter = await leaderboard.listWeekLeaderboard({ weekCode: WEEK_CODE });
  assert.equal(boardAfter.rows.length, 2);
  assert.deepEqual(boardAfter.rows.map((row) => row.rank), [1, 2]);

  const reversal = await sql`select amount, entry_type from rewards.point_ledger where user_id = ${thirdUserId} order by amount asc`;
  assert.ok(reversal.some((row) => row.amount === -150 && row.entry_type === "ADMIN_REVERSAL"));
  const voidedAccount = await sql`select balance, lifetime_spent from rewards.point_accounts where user_id = ${thirdUserId}`;
  assert.equal(voidedAccount[0].balance, 0);

  // Fraud separation: the review SCORE row still exists (only eligibility died).
  const preservedScores = await sql`
    select count(*)::int as n from arena.review_scores s
    join arena.reviews r on r.id = s.review_id
    join arena.submission_versions v on v.id = r.submission_version_id
    join arena.submissions sub on sub.id = v.submission_id
    where sub.enrollment_id = ${thirdEnrollment[0].id}`;
  assert.equal(preservedScores[0].n, 1);

  const voidAudit = await sql`select action from audit.logs where entity_id = ${thirdEnrollment[0].id} order by action`;
  assert.ok(voidAudit.some((row) => row.action === "FRAUD_VOID"));
});
