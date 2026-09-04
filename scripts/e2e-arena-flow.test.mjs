import assert from "node:assert/strict";
import test from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

assert.equal(process.env.APP_ENV, "development", "Arena flow E2E requires APP_ENV=development");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

// Service modules resolve through scripts/node-test-hooks.mjs
// (`test:e2e:flow` wires `--import`). They exercise the real Neon dev DB.
const weekApi = await import("../src/server/arena/project-service.ts");
const enrollmentApi = await import("../src/server/arena/enrollment-service.ts");
const workspaceApi = await import("../src/server/arena/workspace-service.ts");
const submissionApi = await import("../src/server/submissions/service.ts");
const flagsApi = await import("../src/server/ops/feature-flags.ts");

const stamp = Date.now();
const SUBJECT = `e2e-flow-${stamp}`;
const WEEK_CODE = `E2E-FLOW-${stamp}`;
const DIVISION_SLUG = `e2e-flow-div-${stamp}`;
const PROJECT_SLUG = `e2e-flow-project-${stamp}`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function setup() {
  const [user] = await sql`insert into identity.users (auth_subject) values (${SUBJECT}) returning id`;
  const now = new Date();
  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${WEEK_CODE}, 'E2E Flow Week', 'OPEN', ${new Date(now.getTime() - 5 * 60_000)}, ${new Date(now.getTime() + 2 * 60 * 60_000)}, 'Asia/Jakarta')
    returning id`;
  await sql`insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission) values (${week.id}, 1, 3, false)`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, description, is_active, sort_order)
    values (${DIVISION_SLUG}, 'E2E Division', 'End-to-end flow fixture', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at)
    values (${week.id}, ${division.id}, ${PROJECT_SLUG}, 'E2E Project', 'End-to-end flow fixture', 'PUBLISHED', ${now}) returning id`;
  const [requirement] = await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Public work link', 'LINK', true, 1, 1, 'Share a reviewer-accessible link.', 0) returning id`;
  return { userId: user.id, weekId: week.id, projectId: project.id, requirementId: requirement.id };
}

async function cleanup(ids) {
  const { userId, weekId, projectId } = ids;
  await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${userId} and week_id = ${weekId})`;
  await sql`delete from notifications.events where user_id = ${userId} and week_id = ${weekId}`;
  const enrollments = await sql`select id from arena.enrollments where user_id = ${userId} and week_id = ${weekId}`;
  for (const enrollment of enrollments) {
    const submissions = await sql`select id from arena.submissions where enrollment_id = ${enrollment.id}`;
    for (const submission of submissions) {
      const versions = await sql`select id from arena.submission_versions where submission_id = ${submission.id}`;
      for (const version of versions) {
        // Submit now enqueues a review job per accessible version.
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
  await sql`delete from arena.project_submission_requirements where project_id = ${projectId}`;
  await sql`delete from arena.projects where id = ${projectId}`;
  await sql`delete from arena.divisions where slug = ${DIVISION_SLUG}`;
  await sql`delete from arena.week_rules where week_id = ${weekId}`;
  await sql`delete from arena.weeks where id = ${weekId}`;
  await sql`delete from identity.users where id = ${userId}`;
  await sql`delete from ops.feature_flags where key = 'arena-submissions'`;
}

test("end-to-end arena flow: week → projects → enroll → workspace → draft → kill-switch → submit → version", async (t) => {
  const ids = await setup();
  t.after(async () => {
    await cleanup(ids);
    await sql.end({ timeout: 5 });
  });
  const { userId, projectId, requirementId } = ids;

  const week = await weekApi.getCurrentArenaWeek();
  assert.equal(week.id, ids.weekId, "the freshly opened E2E week resolves as current");

  const divisions = await weekApi.listActiveArenaDivisions();
  assert.ok(divisions.some((d) => d.slug === DIVISION_SLUG));

  const projects = await weekApi.listVisibleArenaProjects({});
  const project = projects.find((p) => p.slug === PROJECT_SLUG);
  assert.ok(project, "E2E project is publicly visible");
  const detail = await weekApi.getVisibleArenaProject({ slug: PROJECT_SLUG });
  assert.equal(detail.id, projectId);

  const first = await enrollmentApi.selectArenaProject({ userId, projectId });
  assert.equal(first.created, true);
  const retry = await enrollmentApi.selectArenaProject({ userId, projectId });
  assert.equal(retry.created, false);
  assert.equal(retry.enrollment.id, first.enrollment.id);
  const enrollmentId = first.enrollment.id;

  const workspace = await workspaceApi.patchArenaWorkspace({
    userId, enrollmentId,
    input: { currentStep: "PLAN", planText: "E2E plan", tools: ["Docs"], taskBreakdown: [{ title: "Draft", done: false }], notes: "E2E notes", reviewChecklist: [{ label: "Link works", done: false }] },
  });
  assert.equal(workspace.planText, "E2E plan");

  const draft = await submissionApi.patchArenaSubmissionDraft({
    userId, enrollmentId, input: { explanation: "E2E explanation", notes: "E2E submission notes" },
  });
  assert.equal(draft.explanation, "E2E explanation");

  const link = await submissionApi.addArenaSubmissionLink({
    userId, enrollmentId, input: { requirementId, url: "https://github.com/example/project" },
  });
  assert.equal(link.externalUrl, "https://github.com/example/project");

  // Kill-switch closed → submit refuses with FEATURE_CLOSED, consuming nothing.
  await sql`insert into ops.feature_flags (key, maintenance_mode, message) values ('arena-submissions', true, 'E2E maintenance')
    on conflict (key) do update set maintenance_mode = true, message = 'E2E maintenance'`;
  const closedState = await flagsApi.getArenaFeatureState("arena-submissions");
  assert.deepEqual(closedState, { closed: true, message: "E2E maintenance" });
  await assert.rejects(
    () => submissionApi.submitArenaSubmission({ userId, enrollmentId }),
    (error) => error?.code === "FEATURE_CLOSED",
    "closed kill-switch must refuse submit with FEATURE_CLOSED",
  );

  // Reopen → submit snapshots an immutable version.
  await sql`delete from ops.feature_flags where key = 'arena-submissions'`;
  const result = await submissionApi.submitArenaSubmission({ userId, enrollmentId });
  assert.equal(result.version.versionNumber, 1);
  assert.ok(["ACCESSIBLE", "FAILED"].includes(result.version.accessStatus));
  if (result.version.accessStatus === "ACCESSIBLE") {
    assert.equal(result.allocatedReviewAttempt, true);
    assert.equal(result.version.reviewAttemptNumber, 1);
  } else {
    // Live link probe blocked in this environment — still a valid immutable
    // version, and by rule it must NOT consume a review attempt.
    assert.equal(result.allocatedReviewAttempt, false);
    assert.equal(result.version.reviewAttemptNumber, null);
  }

  const submission = await submissionApi.getArenaSubmission({ userId, enrollmentId });
  assert.equal(submission.explanation, "E2E explanation");
  const versions = await sql`select version_number from arena.submission_versions where submission_id = ${submission.id} order by version_number`;
  assert.deepEqual(versions.map((v) => v.version_number), [1]);
  // Submit always leaves an inbox trace (received or access-failed).
  const notices = await sql`select type from notifications.events where user_id = ${userId} and week_id = ${ids.weekId}`;
  assert.ok(notices.some((notice) => ["SUBMISSION_RECEIVED", "SUBMISSION_ACCESS_FAILED"].includes(notice.type)));
});
