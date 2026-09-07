import assert from "node:assert/strict";
import test, { after } from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

assert.equal(process.env.APP_ENV, "development", "Scheduler tests require APP_ENV=development");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

const scheduler = await import("../src/server/scheduler/service.ts");
const { requireCronCaller } = await import("../src/server/scheduler/cron-auth.ts");
const submissionApi = await import("../src/server/submissions/service.ts");
const enrollmentApi = await import("../src/server/arena/enrollment-service.ts");

const stamp = Date.now();
const WEEK_CODE = `SCHED-${stamp}`;
const DIVISION_SLUG = `sched-div-${stamp}`;
const PROJECT_SLUG = `sched-project-${stamp}`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
after(async () => sql.end({ timeout: 5 }));

function bearer(token) {
  return new Request("https://arena.test/api/cron/week-close", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function setup() {
  const now = new Date();
  const [user] = await sql`insert into identity.users (auth_subject) values (${`sched-${stamp}`}) returning id`;
  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${WEEK_CODE}, 'Scheduler Week', 'OPEN', ${new Date(now.getTime() - 3600_000)},
            ${new Date(now.getTime() + 3600_000)}, 'Asia/Jakarta') returning id`;
  await sql`
    insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission)
    values (${week.id}, 1, 3, false)`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, description, is_active, sort_order)
    values (${DIVISION_SLUG}, 'Scheduler Division', 'scheduler fixture', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at)
    values (${week.id}, ${division.id}, ${PROJECT_SLUG}, 'Scheduler Project', 'scheduler fixture', 'PUBLISHED', ${now})
    returning id`;
  const [linkReq] = await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Work links', 'LINK', false, 0, 5, 'Optional links.', 0) returning id`;

  const selection = await enrollmentApi.selectArenaProject({ userId: user.id, projectId: project.id });
  await submissionApi.addArenaSubmissionLink({
    userId: user.id,
    enrollmentId: selection.enrollment.id,
    input: { requirementId: linkReq.id, url: "https://example.com/" },
  });
  await submissionApi.submitArenaSubmission({ userId: user.id, enrollmentId: selection.enrollment.id });

  // The deadline has to be in the past before a close is legitimate; submitting
  // first and moving it afterwards keeps the submission path realistic.
  await sql`update arena.weeks set submission_deadline_at = ${new Date(now.getTime() - 60_000)} where id = ${week.id}`;
  return { userId: user.id, weekId: week.id, projectId: project.id, divisionId: division.id };
}

async function cleanup(ids) {
  const enrollments = await sql`select id from arena.enrollments where user_id = ${ids.userId}`;
  for (const enrollment of enrollments) {
    const submissions = await sql`select id from arena.submissions where enrollment_id = ${enrollment.id}`;
    for (const submission of submissions) {
      const versions = await sql`select id from arena.submission_versions where submission_id = ${submission.id}`;
      for (const version of versions) {
        await sql`delete from arena.reviews where submission_version_id = ${version.id}`;
        await sql`delete from arena.review_jobs where submission_version_id = ${version.id}`;
        await sql`delete from arena.submission_version_items where submission_version_id = ${version.id}`;
      }
      await sql`delete from arena.submission_versions where submission_id = ${submission.id}`;
      await sql`delete from arena.submission_draft_items where submission_id = ${submission.id}`;
      await sql`delete from arena.upload_intents where submission_id = ${submission.id}`;
      await sql`delete from arena.submissions where id = ${submission.id}`;
    }
    await sql`delete from arena.workspace_progress where enrollment_id = ${enrollment.id}`;
    await sql`delete from arena.enrollments where id = ${enrollment.id}`;
  }
  await sql`delete from arena.weekly_rankings where week_id = ${ids.weekId}`;
  await sql`delete from rewards.point_ledger where user_id = ${ids.userId}`;
  await sql`delete from rewards.point_accounts where user_id = ${ids.userId}`;
  await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${ids.userId})`;
  await sql`delete from notifications.events where user_id = ${ids.userId}`;
  await sql`delete from identity.sessions where user_id = ${ids.userId}`;
  await sql`delete from identity.users where id = ${ids.userId}`;
  await sql`delete from arena.project_submission_requirements where project_id = ${ids.projectId}`;
  await sql`delete from arena.projects where id = ${ids.projectId}`;
  await sql`delete from arena.divisions where id = ${ids.divisionId}`;
  await sql`delete from arena.week_rules where week_id = ${ids.weekId}`;
  await sql`delete from arena.weeks where id = ${ids.weekId}`;
}

test("scheduler auth is fail-closed and accepts only a configured secret", () => {
  const savedCron = process.env.CRON_SECRET;
  const savedInternal = process.env.INTERNAL_AUTOMATION_TOKEN;
  try {
    delete process.env.CRON_SECRET;
    delete process.env.INTERNAL_AUTOMATION_TOKEN;
    // No secret configured anywhere: every call is denied, including a
    // well-formed one. A half-configured deploy must not expose the scheduler.
    assert.throws(() => requireCronCaller(bearer("anything")), (e) => e.code === "FORBIDDEN");
    assert.throws(() => requireCronCaller(bearer(null)), (e) => e.code === "FORBIDDEN");

    process.env.CRON_SECRET = "cron-secret-value";
    assert.equal(requireCronCaller(bearer("cron-secret-value")).callerId, "vercel-cron");
    assert.throws(() => requireCronCaller(bearer("cron-secret-valu3")), (e) => e.code === "FORBIDDEN");
    assert.throws(() => requireCronCaller(bearer("short")), (e) => e.code === "FORBIDDEN");

    // Existing automation credentials keep working for manual/incident runs.
    process.env.INTERNAL_AUTOMATION_TOKEN = "automation-token-value";
    assert.equal(requireCronCaller(bearer("automation-token-value")).callerId, "internal-automation");
  } finally {
    if (savedCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedCron;
    if (savedInternal === undefined) delete process.env.INTERNAL_AUTOMATION_TOKEN;
    else process.env.INTERNAL_AUTOMATION_TOKEN = savedInternal;
  }
});

test("week close and finalize are deadline-gated, review-gated, and idempotent", async (t) => {
  const ids = await setup();
  t.after(async () => cleanup(ids));

  const closed = await scheduler.runWeekClose();
  assert.equal(closed.done, true);
  const [afterClose] = await sql`select status from arena.weeks where id = ${ids.weekId}`;
  assert.equal(afterClose.status, "FINALIZING");

  // A pending review job blocks finalization: the job reports it and waits for
  // the next tick instead of throwing the run away.
  const waiting = await scheduler.runWeekFinalize();
  assert.equal(waiting.done, true);
  assert.ok(
    waiting.detail.waiting.some((entry) => entry.startsWith(WEEK_CODE)),
    `expected ${WEEK_CODE} to be waiting on reviews, got ${JSON.stringify(waiting.detail)}`,
  );
  const [stillFinalizing] = await sql`select status from arena.weeks where id = ${ids.weekId}`;
  assert.equal(stillFinalizing.status, "FINALIZING");

  // Reviews done: the same job now finalizes, and repeats without double-awarding.
  await sql`
    delete from arena.review_jobs where submission_version_id in (
      select v.id from arena.submission_versions v
      join arena.submissions s on s.id = v.submission_id
      where s.week_id = ${ids.weekId})`;
  const finalized = await scheduler.runWeekFinalize();
  assert.equal(finalized.detail.waiting.length, 0, JSON.stringify(finalized.detail));
  assert.equal(finalized.detail.finalized.length, 1);
  const [afterFinalize] = await sql`select status from arena.weeks where id = ${ids.weekId}`;
  assert.equal(afterFinalize.status, "FINALIZED");

  const ledgerBefore = await sql`select count(*)::int as n from rewards.point_ledger where user_id = ${ids.userId}`;
  const again = await scheduler.runWeekFinalize();
  assert.equal(again.detail.skipped, "no week awaiting finalization");
  const ledgerAfter = await sql`select count(*)::int as n from rewards.point_ledger where user_id = ${ids.userId}`;
  assert.equal(ledgerAfter[0].n, ledgerBefore[0].n, "a repeated run must not award points twice");

  // Nothing left OPEN and overdue: the close job reports a clean no-op.
  const noop = await scheduler.runWeekClose();
  assert.equal(noop.detail.skipped, "no open week past its deadline");
});

test("maintenance jobs report counts and disabled generation stays visible", async () => {
  const savedEmailKey = process.env.RESEND_API_KEY;
  let flushed;
  try {
    delete process.env.RESEND_API_KEY;
    flushed = await scheduler.runEmailFlush();
  } finally {
    if (savedEmailKey !== undefined) process.env.RESEND_API_KEY = savedEmailKey;
  }
  assert.equal(flushed.done, true);
  for (const key of ["sent", "failed", "skipped"]) {
    assert.equal(typeof flushed.detail[key], "number", `email flush must report ${key}`);
  }

  const cleaned = await scheduler.runSessionCleanup();
  assert.equal(typeof cleaned.detail.deleted, "number");

  // Disabled automation must not create weeks, even on a scheduled tick.
  const wednesday = new Date("2026-09-02T12:00:00+07:00");
  const saved = process.env.ARENA_GENERATION_ENABLED;
  try {
    delete process.env.ARENA_GENERATION_ENABLED;
    const generated = await scheduler.runProjectGenerate(wednesday);
    assert.equal(generated.done, false);
    assert.equal(generated.detail.skipped, "generation disabled");
  } finally {
    if (saved === undefined) delete process.env.ARENA_GENERATION_ENABLED;
    else process.env.ARENA_GENERATION_ENABLED = saved;
  }
});

test("reviews-run drains the queue in small ticks and never lets a broken provider run wild", async () => {
  const base = {
    provider: () => ({ name: "test-provider" }),
    maxJobs: 3,
    budgetMs: 45_000,
    clock: () => 0,
  };
  const completed = (n) => ({ versionId: `v${n}`, status: "COMPLETED_HIDDEN", aiScore: 80, secondJudge: { ran: false } });

  // Unconfigured AI is quiet, not alarming — and must not touch the queue.
  let touched = 0;
  const unconfigured = await scheduler.runReviewsRun(new Date(), {
    ...base,
    provider: () => { throw new Error("AI review provider is not configured."); },
    runOne: async () => { touched += 1; return completed(1); },
  });
  assert.equal(unconfigured.done, false);
  assert.match(unconfigured.detail.skipped, /not configured/);
  assert.equal(touched, 0, "an unconfigured tick must not claim a job");

  // An empty queue is a successful tick with nothing to show for it.
  const empty = await scheduler.runReviewsRun(new Date(), { ...base, runOne: async () => null });
  assert.equal(empty.done, true);
  assert.equal(empty.detail.reviewed, 0);
  assert.equal(empty.detail.stopped, "queue empty");

  // A tick takes at most maxJobs, leaving the rest for the next trigger.
  let runs = 0;
  const batch = await scheduler.runReviewsRun(new Date(), { ...base, runOne: async () => completed(++runs) });
  assert.equal(batch.done, true);
  assert.equal(batch.detail.reviewed, 3);
  assert.equal(runs, 3, "the tick must stop at its job ceiling, not drain forever");

  // The wall-clock budget stops it even when jobs remain, because an overrun
  // invocation is killed mid-review and leaves jobs leased to a dead worker.
  let ticks = 0;
  let calls = 0;
  const timed = await scheduler.runReviewsRun(new Date(), {
    ...base,
    maxJobs: 10,
    budgetMs: 100,
    clock: () => (ticks++ === 0 ? 0 : 1000),
    runOne: async () => { calls += 1; return completed(calls); },
  });
  assert.equal(timed.done, true);
  assert.match(timed.detail.stopped, /time budget/);
  assert.ok(calls <= 1, "the budget must cut the batch short");

  // A failing provider stops the tick: the job it broke is already handed back
  // for retry, and continuing would burn every queued job's attempts too.
  let attempts = 0;
  const broken = await scheduler.runReviewsRun(new Date(), {
    ...base,
    runOne: async () => { attempts += 1; throw new Error("REVIEW_PROVIDER_FAILED"); },
  });
  assert.equal(broken.done, false);
  assert.match(broken.detail.failed, /REVIEW_PROVIDER_FAILED/);
  assert.equal(attempts, 1, "a broken provider must be tried once per tick, not once per job");
});

test("reviews-run bounds the job itself, not just the decision to start one", async () => {
  const base = {
    provider: () => ({ name: "test-provider" }),
    maxJobs: 3,
    budgetMs: 45_000,
    clock: () => 0,
  };
  const completed = (n) => ({ versionId: `v${n}`, status: "COMPLETED_HIDDEN", aiScore: 80, secondJudge: { ran: false } });

  // Each job is told how much of the tick is left, so the provider ceiling can
  // never outlive the invocation. Without this a job claimed at 44.9s could hold
  // the function for a further 120s (primary) plus 120s (second judge).
  const budgets = [];
  let now = 0;
  await scheduler.runReviewsRun(new Date(), {
    ...base,
    maxJobs: 3,
    budgetMs: 30_000,
    clock: () => now,
    runOne: async (options) => { budgets.push(options?.budgetMs); now += 10_000; return completed(budgets.length); },
  });
  assert.deepEqual(budgets, [30_000, 20_000, 10_000], "each job must receive the tick's REMAINING time, not the full budget");

  // A job aborted because the tick ran out is not a provider outage: it was
  // handed back for retry, so the tick reports `stopped`, stays done, and does
  // not page anyone.
  let elapsed = 0;
  const abort = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  const starved = await scheduler.runReviewsRun(new Date(), {
    ...base,
    budgetMs: 1_000,
    clock: () => elapsed,
    runOne: async () => { elapsed = 5_000; throw abort; },
  });
  assert.equal(starved.done, true, "running out of budget is not a failed tick");
  assert.match(starved.detail.stopped, /time budget reached mid-review/);
  assert.equal(starved.detail.failed, undefined);

  // The same abort BEFORE the deadline is a real provider timeout and must stay
  // visible as a failure — otherwise a provider hanging on every call looks
  // exactly like a healthy busy queue.
  const genuine = await scheduler.runReviewsRun(new Date(), {
    ...base,
    budgetMs: 45_000,
    clock: () => 0,
    runOne: async () => { throw abort; },
  });
  assert.equal(genuine.done, false, "a provider timeout inside the budget is still a failure");
  assert.match(genuine.detail.failed, /aborted/);
});

test("reviews-run is a registered scheduled job", () => {
  assert.equal(typeof scheduler.JOBS["reviews-run"], "function");
});
