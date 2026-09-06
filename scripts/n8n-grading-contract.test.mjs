/**
 * The exact HTTP contract an n8n grading workflow must implement.
 *
 * Handoff blocker 4: the live workflow still posts the old "verdict" payload at
 * the new endpoint. Everything proving the pipeline so far drove the in-process
 * worker (`runOneReviewJob`), so the claim → complete/fail loop that n8n must
 * actually speak had never been exercised over its own routes.
 *
 * This drives the REAL route handlers with constructed Requests, so the bearer
 * guard, the zod schemas and the services all run exactly as they do in
 * production — no live workflow is touched and no external AI is called.
 *
 * Requires an otherwise-idle review queue: /claim takes the oldest available job
 * in the whole database, so do not run this beside another review suite.
 */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.APP_ENV, "development", "The grading contract suite requires APP_ENV=development");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

// Fixed for this process only: the guard is fail-closed, so the suite has to
// supply the credential it is testing rather than borrow a deployment's.
const TOKEN = "contract-suite-automation-token";
process.env.INTERNAL_AUTOMATION_TOKEN = TOKEN;

const enrollmentApi = await import("../src/server/arena/enrollment-service.ts");
const submissionApi = await import("../src/server/submissions/service.ts");
const claimRoute = await import("../src/app/api/internal/reviews/claim/route.ts");
const completeRoute = await import("../src/app/api/internal/reviews/complete/route.ts");
const failRoute = await import("../src/app/api/internal/reviews/fail/route.ts");

const stamp = Date.now();
const WORKER_ID = "n8n-grading-contract";

// Long enough that a >= 12 character quote can be lifted verbatim from it.
const EXPLANATION = "Saya menggabungkan tiga file penjualan menjadi satu tabel master lalu menghitung margin per channel.";
const QUOTE = "satu tabel master";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
after(() => sql.end({ timeout: 5 }));

async function post(route, body, token = TOKEN) {
  const headers = { "Content-Type": "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const response = await route.POST(
    new Request("https://arena.test/api/internal/reviews", { method: "POST", headers, body: JSON.stringify(body) }),
  );
  return { status: response.status, body: await response.json() };
}

async function setup(label) {
  const names = {
    subject: `e2e-n8n-${label}-${stamp}`,
    weekCode: `E2E-N8N-${label}-${stamp}`,
    divisionSlug: `e2e-n8n-div-${label}-${stamp}`,
    projectSlug: `e2e-n8n-project-${label}-${stamp}`,
  };
  const [user] = await sql`insert into identity.users (auth_subject) values (${names.subject}) returning id`;
  const now = new Date();
  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${names.weekCode}, 'n8n Contract Week', 'OPEN', ${new Date(now.getTime() - 5 * 60_000)},
            ${new Date(now.getTime() + 2 * 60 * 60_000)}, 'Asia/Jakarta') returning id`;
  await sql`insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts) values (${week.id}, 1, 3)`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, is_active, sort_order)
    values (${names.divisionSlug}, 'n8n Contract Division', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at)
    values (${week.id}, ${division.id}, ${names.projectSlug}, 'n8n Contract Project', 'fixture', 'PUBLISHED', ${now}) returning id`;
  await sql`insert into arena.project_rubric_criteria (project_id, name, weight, max_score, sort_order)
            values (${project.id}, 'Execution', 3, 100, 0)`;
  await sql`insert into arena.project_rubric_criteria (project_id, name, weight, max_score, sort_order)
            values (${project.id}, 'Communication', 1, 100, 1)`;
  const [requirement] = await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, sort_order)
    values (${project.id}, 'Public work link', 'LINK', true, 1, 1, 0) returning id`;
  return { userId: user.id, weekId: week.id, projectId: project.id, requirementId: requirement.id, names };
}

async function cleanup(ids) {
  const { userId, weekId, projectId, names } = ids;
  // Submitting raises a RECEIVED notice, and events reference the week.
  await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where week_id = ${weekId})`;
  await sql`delete from notifications.events where week_id = ${weekId}`;
  const enrollments = await sql`select id from arena.enrollments where user_id = ${userId} and week_id = ${weekId}`;
  for (const enrollment of enrollments) {
    const submissions = await sql`select id from arena.submissions where enrollment_id = ${enrollment.id}`;
    for (const submission of submissions) {
      const versions = await sql`select id from arena.submission_versions where submission_id = ${submission.id}`;
      for (const version of versions) {
        const reviews = await sql`select id from arena.reviews where submission_version_id = ${version.id}`;
        for (const review of reviews) {
          await sql`delete from arena.skill_evidence where review_id = ${review.id}`;
          await sql`delete from arena.review_scores where review_id = ${review.id}`;
          await sql`delete from arena.review_overrides where review_id = ${review.id}`;
          await sql`delete from audit.logs where entity_id = ${review.id}`;
        }
        await sql`delete from arena.reviews where submission_version_id = ${version.id}`;
        const jobs = await sql`select id from arena.review_jobs where submission_version_id = ${version.id}`;
        for (const job of jobs) await sql`delete from audit.logs where entity_id = ${job.id}`;
        await sql`delete from arena.review_jobs where submission_version_id = ${version.id}`;
        // Migration 0007 hangs artifacts off the VERSION, not the review — the
        // finalization suite once deadlocked on exactly this.
        await sql`delete from arena.review_artifacts where submission_version_id = ${version.id}`;
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
  await sql`delete from arena.divisions where slug = ${names.divisionSlug}`;
  await sql`delete from arena.week_rules where week_id = ${weekId}`;
  await sql`delete from arena.weeks where id = ${weekId}`;
  await sql`delete from identity.users where id = ${userId}`;
}

async function submitOneVersion(ids) {
  const { userId, projectId, requirementId } = ids;
  const selection = await enrollmentApi.selectArenaProject({ userId, projectId });
  const enrollmentId = selection.enrollment.id;
  await submissionApi.patchArenaSubmissionDraft({
    userId,
    enrollmentId,
    input: { explanation: EXPLANATION, notes: "Catatan fixture kontrak n8n." },
  });
  // example.com answers 2xx; a dead link would make the version FAILED-access,
  // which by rule queues no review job at all.
  await submissionApi.addArenaSubmissionLink({ userId, enrollmentId, input: { requirementId, url: "https://example.com/" } });
  const submitted = await submissionApi.submitArenaSubmission({ userId, enrollmentId });
  assert.equal(submitted.version.accessStatus, "ACCESSIBLE");
  return submitted.version.id;
}

/** Confidence stays >= 0.7 with no warnings so the second judge never runs — this suite must not call a live model. */
function gradeFrom(job, { evidence } = {}) {
  return {
    criteria: job.input.rubric.map((criterion) => ({
      criterionId: criterion.id,
      score: 80,
      evidence: [evidence ?? `[explanation] ${QUOTE}`],
      issues: [],
      confidence: 0.9,
    })),
    strengths: ["Struktur datanya konsisten."],
    priorityImprovements: ["Tambahkan pembanding antar periode."],
    confidence: 0.9,
  };
}

// Cleanup runs inside the test body, not in an after-hook: `--test-force-exit`
// (needed here, or the suite hangs on live HTTP sockets) can terminate the
// process while an after-hook is still deleting, which silently leaks fixtures.
test("n8n grading contract: bearer guard, blind claim, evidence rules, and a completed lease", async () => {
  const ids = await setup("ok");
  try {
  const versionId = await submitOneVersion(ids);

  // The guard is fail-closed in both directions a workflow can get wrong.
  assert.equal((await post(claimRoute, { workerId: WORKER_ID }, null)).status, 403);
  assert.equal((await post(claimRoute, { workerId: WORKER_ID }, "wrong-token")).status, 403);
  assert.equal((await post(claimRoute, {})).status, 400, "workerId is required");

  const claim = await post(claimRoute, { workerId: WORKER_ID });
  assert.equal(claim.status, 200);
  const job = claim.body.data.job;
  assert.ok(job, "expected a claimable job; another review suite may be holding the queue");
  assert.equal(job.versionId, versionId);

  // What the workflow is allowed to see: the rubric and the extracted sources,
  // never a previous score or the participant's identity.
  assert.ok(Array.isArray(job.input.rubric) && job.input.rubric.length === 2);
  assert.ok(Array.isArray(job.input.sources) && job.input.sources.length > 0, "sources must be extracted for the grader");
  const explanation = job.input.sources.find((source) => source.id === "explanation");
  assert.ok(explanation && explanation.text.includes(QUOTE));
  assert.equal(JSON.stringify(job).includes("aiScore"), false, "a blind claim must not leak previous scores");

  // Evidence the sources cannot support is refused, and the job is not consumed.
  const fabricated = await post(completeRoute, {
    jobId: job.jobId,
    workerId: WORKER_ID,
    output: gradeFrom(job, { evidence: "[explanation] angka penjualan naik tiga kali lipat" }),
  });
  assert.equal(fabricated.status, 422);
  assert.equal(fabricated.body.error.code, "REVIEW_VALIDATION_FAILED");

  // A rejected output releases the lease and puts the job back with a backoff
  // rather than burning it — so each further probe needs its own claim.
  const [afterInvalid] = await sql`select status from arena.review_jobs where id = ${job.jobId}`;
  assert.equal(afterInvalid.status, "RETRY");

  const reclaim = async () => {
    // Clearly in the past: the database clock can run ahead of this process's,
    // and the claim predicate compares against the application's clock.
    await sql`update arena.review_jobs set available_at = now() - interval '1 hour' where id = ${job.jobId}`;
    const response = await post(claimRoute, { workerId: WORKER_ID });
    const next = response.body.data.job;
    assert.equal(next.jobId, job.jobId, "the same job must come back after its backoff");
    return next;
  };

  // Evidence missing its [source-id] anchor is refused for the same reason.
  const anchorless = await reclaim();
  const unanchored = await post(completeRoute, {
    jobId: anchorless.jobId,
    workerId: WORKER_ID,
    output: gradeFrom(anchorless, { evidence: QUOTE }),
  });
  assert.equal(unanchored.body.error.code, "REVIEW_VALIDATION_FAILED");

  const retried = await reclaim();

  const completed = await post(completeRoute, { jobId: retried.jobId, workerId: WORKER_ID, output: gradeFrom(retried) });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.completed.status, "COMPLETED_HIDDEN");
  assert.equal(completed.body.data.completed.secondJudge.ran, false, "a confident, warning-free review must not call the judge");

  // The backend owns the arithmetic: the worker proposed 80s, never a final score.
  const [review] = await sql`select ai_score, final_score, status from arena.reviews where submission_version_id = ${versionId}`;
  assert.equal(review.status, "COMPLETED_HIDDEN");
  assert.equal(Math.round(Number(review.ai_score)), 80);

  // Replaying a completed lease must not double-score.
  const replay = await post(completeRoute, { jobId: retried.jobId, workerId: WORKER_ID, output: gradeFrom(retried) });
  assert.notEqual(replay.status, 200);
  const [{ n }] = await sql`select count(*)::int n from arena.reviews where submission_version_id = ${versionId}`;
  assert.equal(n, 1, "a replayed completion must never create a second review");
  } finally {
    await cleanup(ids);
  }
});

test("n8n grading contract: a worker-reported failure retries without spending a participant attempt", async () => {
  const ids = await setup("fail");
  try {
  const versionId = await submitOneVersion(ids);

  const claim = await post(claimRoute, { workerId: WORKER_ID });
  const job = claim.body.data.job;
  assert.equal(job.versionId, versionId);

  assert.equal((await post(failRoute, { jobId: job.jobId, workerId: WORKER_ID, code: "MODEL_TIMEOUT" })).status, 400,
    "a failure report must carry a message");

  const failed = await post(failRoute, {
    jobId: job.jobId,
    workerId: WORKER_ID,
    code: "MODEL_TIMEOUT",
    message: "upstream model did not answer within the lease",
  });
  assert.equal(failed.status, 200);
  assert.equal(failed.body.data.recorded.status, "RETRY");

  // The participant is untouched: a technical failure never consumes one of
  // their three valid review attempts (PRD §42).
  const [version] = await sql`select review_status, review_attempt_number from arena.submission_versions where id = ${versionId}`;
  assert.equal(version.review_status, "QUEUED");
  assert.equal(version.review_attempt_number, 1);

  // A worker that no longer holds the lease cannot report on the job.
  const stale = await post(failRoute, {
    jobId: job.jobId,
    workerId: "someone-else",
    code: "MODEL_TIMEOUT",
    message: "stale worker should be refused",
  });
  assert.notEqual(stale.status, 200);
  } finally {
    await cleanup(ids);
  }
});
