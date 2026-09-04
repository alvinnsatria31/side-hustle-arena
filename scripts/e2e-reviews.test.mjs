import assert from "node:assert/strict";
import test from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

assert.equal(process.env.APP_ENV, "development", "Reviews E2E requires APP_ENV=development");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

// Service modules resolve through scripts/node-test-hooks.mjs
// (`test:e2e:reviews` wires `--import`). They exercise the real Neon dev DB.
const enrollmentApi = await import("../src/server/arena/enrollment-service.ts");
const submissionApi = await import("../src/server/submissions/service.ts");
const worker = await import("../src/server/reviews/worker.ts");
const admin = await import("../src/server/reviews/admin.ts");
const evalIngest = await import("../src/server/reviews/eval-ingest.ts");
const scorer = await import("../src/server/reviews/scorer.ts");

const stamp = Date.now();
const SUBJECT = `e2e-reviews-${stamp}`;
const WEEK_CODE = `E2E-REVIEWS-${stamp}`;
const DIVISION_SLUG = `e2e-reviews-div-${stamp}`;
const PROJECT_SLUG = `e2e-reviews-project-${stamp}`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function setup() {
  const [user] = await sql`insert into identity.users (auth_subject) values (${SUBJECT}) returning id`;
  const now = new Date();
  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${WEEK_CODE}, 'E2E Reviews Week', 'OPEN', ${new Date(now.getTime() - 5 * 60_000)}, ${new Date(now.getTime() + 2 * 60 * 60_000)}, 'Asia/Jakarta')
    returning id`;
  await sql`insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission) values (${week.id}, 1, 3, false)`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, description, is_active, sort_order)
    values (${DIVISION_SLUG}, 'E2E Reviews Division', 'Reviews E2E fixture', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at)
    values (${week.id}, ${division.id}, ${PROJECT_SLUG}, 'E2E Reviews Project', 'Reviews E2E fixture', 'PUBLISHED', ${now}) returning id`;
  // Weighted rubric (3:1) so backend arithmetic is verifiable, not just present.
  await sql`insert into arena.project_rubric_criteria (project_id, name, weight, max_score, sort_order) values (${project.id}, 'Execution', 3, 100, 0)`;
  await sql`insert into arena.project_rubric_criteria (project_id, name, weight, max_score, sort_order) values (${project.id}, 'Communication', 1, 100, 1)`;
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
    await sql`delete from arena.enrollments where id = ${enrollment.id}`;
  }
  await sql`delete from arena.project_submission_requirements where project_id = ${projectId}`;
  await sql`delete from arena.project_rubric_criteria where project_id = ${projectId}`;
  await sql`delete from arena.projects where id = ${projectId}`;
  await sql`delete from arena.divisions where slug = ${DIVISION_SLUG}`;
  await sql`delete from arena.week_rules where week_id = ${weekId}`;
  await sql`delete from arena.weeks where id = ${weekId}`;
  await sql`delete from identity.users where id = ${userId}`;
}

test("end-to-end review pipeline: submit → queue → claim → stub review → scores → rerun → override → audit", async (t) => {
  const ids = await setup();
  t.after(async () => {
    await cleanup(ids);
    await sql.end({ timeout: 5 });
  });
  const { userId, projectId, requirementId } = ids;

  const selection = await enrollmentApi.selectArenaProject({ userId, projectId });
  const enrollmentId = selection.enrollment.id;
  await submissionApi.patchArenaSubmissionDraft({
    userId, enrollmentId, input: { explanation: "Reviews E2E explanation", notes: "Reviews E2E notes" },
  });
  // example.com reliably answers 2xx (a 404 like a fake repo path would make
  // the version FAILED-access, which by rule queues no review job).
  await submissionApi.addArenaSubmissionLink({
    userId, enrollmentId, input: { requirementId, url: "https://example.com/" },
  });
  const submitted = await submissionApi.submitArenaSubmission({ userId, enrollmentId });
  assert.equal(submitted.version.accessStatus, "ACCESSIBLE");
  const queuedRow = await sql`select review_status from arena.submission_versions where id = ${submitted.version.id}`;
  assert.equal(queuedRow[0].review_status, "QUEUED");

  const jobs = await sql`select id, status, attempt_count from arena.review_jobs where submission_version_id = ${submitted.version.id}`;
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, "PENDING");

  // Local dev worker: claim (lease) + stub primary + server-side persist.
  const completed = await worker.runOneReviewJob({});
  assert.ok(completed, "expected a claimed job");
  assert.equal(completed.versionId, submitted.version.id);
  assert.equal(completed.runNumber, 1);
  assert.equal(completed.status, "COMPLETED_HIDDEN");
  assert.equal(completed.secondJudge.ran, false);
  assert.ok(completed.aiScore >= 0 && completed.aiScore <= 100);

  const stored = await sql`select id, ai_score, final_score, status, run_number from arena.reviews where submission_version_id = ${submitted.version.id}`;
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, "COMPLETED_HIDDEN");
  assert.equal(Number(stored[0].ai_score), completed.aiScore);
  assert.equal(Number(stored[0].final_score), completed.aiScore);
  const scores = await sql`select rubric_criterion_id, raw_score, max_score, weighted_score from arena.review_scores where review_id = ${stored[0].id}`;
  assert.equal(scores.length, 2);
  const expected = scorer.computeWeightedScore(
    scores.map((score) => ({
      criterionId: score.rubric_criterion_id,
      score: Number(score.raw_score),
      evidence: ["x"],
      issues: [],
      confidence: 0.9,
    })),
    [
      { id: scores[0].rubric_criterion_id, name: "a", description: null, weight: 3, maxScore: 100, reviewInstruction: null },
      { id: scores[1].rubric_criterion_id, name: "b", description: null, weight: 1, maxScore: 100, reviewInstruction: null },
    ],
  );
  // Backend math is self-consistent with the persisted rows (weights 3:1).
  assert.ok(Math.abs(expected.aiScore - completed.aiScore) < 1.5);

  const versionRow = await sql`select review_status from arena.submission_versions where id = ${submitted.version.id}`;
  assert.equal(versionRow[0].review_status, "COMPLETED");
  const jobRow = await sql`select status from arena.review_jobs where submission_version_id = ${submitted.version.id}`;
  assert.equal(jobRow[0].status, "COMPLETED");

  // Admin rerun: new run queued, old review preserved, user attempt untouched.
  const rerun = await admin.rerunReview({ versionId: submitted.version.id, actorSubject: "e2e-admin", reason: "E2E rerun check" });
  assert.equal(rerun.nextRunNumber, 2);
  const second = await worker.runOneReviewJob({ stubConfidence: 0.5 });
  assert.ok(second, "expected the rerun job to be claimable");
  assert.equal(second.runNumber, 2);
  assert.equal(second.secondJudge.ran, true);
  assert.ok(["COMPLETED_HIDDEN", "NEEDS_RESOLUTION"].includes(second.status));
  const bothRuns = await sql`select run_number from arena.reviews where submission_version_id = ${submitted.version.id} order by run_number`;
  assert.deepEqual(bothRuns.map((row) => row.run_number), [1, 2]);

  const attempts = await sql`select review_attempts_used from arena.submissions where enrollment_id = ${enrollmentId}`;
  assert.equal(attempts[0].review_attempts_used, 1);

  // Admin override: history appended, original AI score preserved.
  const overridden = await admin.overrideReview({ reviewId: second.reviewId, actorSubject: "e2e-admin", newScore: 88, reason: "E2E override check" });
  assert.equal(overridden.newScore, 88);
  const afterOverride = await sql`select ai_score, final_score from arena.reviews where id = ${second.reviewId}`;
  assert.equal(Number(afterOverride[0].ai_score), second.aiScore);
  assert.equal(Number(afterOverride[0].final_score), 88);
  const overrides = await sql`select previous_score, new_score, reason from arena.review_overrides where review_id = ${second.reviewId}`;
  assert.equal(overrides.length, 1);
  assert.equal(Number(overrides[0].new_score), 88);

  // External eval ingest (VPS/n8n engine): resubmit for attempt 2, then the
  // grader posts its structured output through the same lease pipeline.
  const resubmitted = await submissionApi.submitArenaSubmission({ userId, enrollmentId });
  assert.equal(resubmitted.version.versionNumber, 2);
  assert.equal(resubmitted.version.accessStatus, "ACCESSIBLE");
  const criteria = await sql`select id from arena.project_rubric_criteria where project_id = ${projectId} order by sort_order`;
  const externalOutput = {
    criteria: criteria.map((criterion) => ({
      criterionId: criterion.id,
      score: 75,
      evidence: ["External grader observed a complete deliverable."],
      issues: [],
      confidence: 0.85,
    })),
    strengths: ["External strength."],
    priorityImprovements: ["External improvement."],
    confidence: 0.85,
  };
  const ingested = await evalIngest.ingestExternalReview({
    versionId: resubmitted.version.id,
    workerLabel: "e2e-n8n",
    output: externalOutput,
    model: "e2e-external-v1",
  });
  assert.equal(ingested.deduped, false);
  assert.equal(ingested.runNumber, 1);
  assert.ok(ingested.aiScore >= 0 && ingested.aiScore <= 100);
  // Duplicate delivery is a safe no-op: the first delivery won.
  const duplicate = await evalIngest.ingestExternalReview({
    versionId: resubmitted.version.id,
    workerLabel: "e2e-n8n",
    output: externalOutput,
    model: "e2e-external-v1",
  });
  assert.equal(duplicate.deduped, true);
  const evalAudit = await sql`select action from audit.logs where entity_id = ${ingested.reviewId} and action = 'EVAL_INGESTED'`;
  assert.equal(evalAudit.length, 1);

  const auditActions = await sql`select distinct action from audit.logs where entity_id in (${submitted.version.id}, ${second.reviewId}, ${jobs[0].id}, ${ingested.reviewId}) order by action`;
  const actions = new Set(auditActions.map((row) => row.action));
  for (const expectedAction of ["REVIEW_ENQUEUED", "REVIEW_CLAIMED", "REVIEW_COMPLETED", "REVIEW_RERUN", "REVIEW_OVERRIDE", "EVAL_INGESTED"]) {
    assert.ok(actions.has(expectedAction), `missing audit action ${expectedAction}`);
  }
});
