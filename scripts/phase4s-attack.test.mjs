import assert from "node:assert/strict";
import test, { after } from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

assert.equal(process.env.APP_ENV, "development", "Phase 4S attack tests require APP_ENV=development");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

// Service modules resolve through scripts/node-test-hooks.mjs.
// They exercise the real Neon DEV database. Never production.
const enrollmentApi = await import("../src/server/arena/enrollment-service.ts");
const workspaceApi = await import("../src/server/arena/workspace-service.ts");
const submissionApi = await import("../src/server/submissions/service.ts");
const resultApi = await import("../src/server/finalization/result-service.ts");

const stamp = Date.now();
const WEEK_CODE = `P4S-${stamp}`;
const DIVISION_SLUG = `p4s-div-${stamp}`;
const PROJECT_SLUG = `p4s-project-${stamp}`;
const SUBJECT_A = `p4s-a-${stamp}`;
const SUBJECT_B = `p4s-b-${stamp}`;
const SUBJECT_C = `p4s-c-${stamp}`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const orphanKeys = [];

// Shared handle: close once after every test in this file.
after(async () => {
  await sql.end({ timeout: 5 });
});

async function setup() {
  const [userA] = await sql`insert into identity.users (auth_subject) values (${SUBJECT_A}) returning id`;
  const [userB] = await sql`insert into identity.users (auth_subject) values (${SUBJECT_B}) returning id`;
  const [userC] = await sql`insert into identity.users (auth_subject) values (${SUBJECT_C}) returning id`;
  const now = new Date();
  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${WEEK_CODE}, 'P4S Week', 'OPEN', ${new Date(now.getTime() - 5 * 60_000)}, ${new Date(now.getTime() + 2 * 60 * 60_000)}, 'Asia/Jakarta')
    returning id, submission_deadline_at`;
  await sql`insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission) values (${week.id}, 1, 3, false)`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, description, is_active, sort_order)
    values (${DIVISION_SLUG}, 'P4S Division', 'Phase 4S fixture', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at)
    values (${week.id}, ${division.id}, ${PROJECT_SLUG}, 'P4S Project', 'Phase 4S fixture', 'PUBLISHED', ${now}) returning id`;
  const [linkReq] = await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Public work link', 'LINK', true, 1, 2, 'Share a reviewer-accessible link.', 0) returning id`;
  const [fileReq] = await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Source file', 'FILE', false, 0, 1, 'Optional source file.', 0) returning id`;
  return {
    userA: userA.id, userB: userB.id, userC: userC.id,
    weekId: week.id, deadline: week.submission_deadline_at,
    projectId: project.id, linkReqId: linkReq.id, fileReqId: fileReq.id,
  };
}

async function cleanup(ids) {
  const { userA, userB, userC, weekId, projectId } = ids;
  for (const userId of [userA, userB, userC]) {
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${userId} and week_id = ${weekId})`;
    await sql`delete from notifications.events where user_id = ${userId} and week_id = ${weekId}`;
    const enrollments = await sql`select id from arena.enrollments where user_id = ${userId} and week_id = ${weekId}`;
    for (const enrollment of enrollments) {
      const submissions = await sql`select id from arena.submissions where enrollment_id = ${enrollment.id}`;
      for (const submission of submissions) {
        const versions = await sql`select id from arena.submission_versions where submission_id = ${submission.id}`;
        for (const version of versions) {
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
    await sql`delete from identity.users where id = ${userId}`;
  }
  await sql`delete from arena.project_submission_requirements where project_id = ${projectId}`;
  await sql`delete from arena.projects where id = ${projectId}`;
  await sql`delete from arena.divisions where slug = ${DIVISION_SLUG}`;
  await sql`delete from arena.week_rules where week_id = ${weekId}`;
  await sql`delete from arena.weeks where id = ${weekId}`;
  await sql`delete from ops.feature_flags where key = 'arena-submissions'`;
  // Best-effort COS orphan sweep for keys recorded by live-object tests.
  const storage = await import("../src/server/storage/upload.ts");
  for (const key of orphanKeys) {
    await storage.deletePrivateObject(key).catch(() => undefined);
  }
}

async function rejectsWith(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.code, code, `expected ${code}, got ${error?.code}: ${error?.message}`);
    return true;
  });
}

test("phase 4S: user B cannot touch user A objects (IDOR matrix)", async (t) => {
  const ids = await setup();
  t.after(async () => {
    await cleanup(ids);
  });
  const { userA, userB, projectId, linkReqId } = ids;
  const { enrollment } = await enrollmentApi.selectArenaProject({ userId: userA, projectId });
  const enrollmentId = enrollment.id;
  const bEnroll = await enrollmentApi.selectArenaProject({ userId: userB, projectId });

  await rejectsWith(enrollmentApi.getArenaEnrollment({ userId: userB, enrollmentId }), "ENROLLMENT_NOT_FOUND");
  await rejectsWith(workspaceApi.getArenaWorkspace({ userId: userB, enrollmentId }), "ENROLLMENT_NOT_FOUND");
  await rejectsWith(
    workspaceApi.patchArenaWorkspace({ userId: userB, enrollmentId, input: { notes: "pwned" } }),
    "ENROLLMENT_NOT_FOUND",
  );
  await rejectsWith(submissionApi.getArenaSubmission({ userId: userB, enrollmentId }), "ENROLLMENT_NOT_FOUND");
  await rejectsWith(
    submissionApi.patchArenaSubmissionDraft({ userId: userB, enrollmentId, input: { explanation: "pwned" } }),
    "ENROLLMENT_NOT_FOUND",
  );
  await rejectsWith(
    submissionApi.addArenaSubmissionLink({ userId: userB, enrollmentId, input: { requirementId: linkReqId, url: "https://example.com/pwned" } }),
    "ENROLLMENT_NOT_FOUND",
  );
  await rejectsWith(
    submissionApi.createArenaUploadIntent({ userId: userB, enrollmentId, input: { requirementId: ids.fileReqId, filename: "evil.pdf", mimeType: "application/pdf", sizeBytes: 10 } }),
    "ENROLLMENT_NOT_FOUND",
  );
  // Cross-enrollment intent theft: B uses their OWN enrollment but A's intent id.
  const aIntent = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId, input: { requirementId: ids.fileReqId, filename: "a2.pdf", mimeType: "application/pdf", sizeBytes: 9 } });
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userB, enrollmentId: bEnroll.enrollment.id, intentId: aIntent.intentId }),
    "UPLOAD_INTENT_NOT_FOUND",
  );
  await sql`delete from arena.upload_intents where id = ${aIntent.intentId}`;
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userB, enrollmentId, intentId: "00000000-0000-4000-8000-000000000000" }),
    "ENROLLMENT_NOT_FOUND",
  );
  await rejectsWith(submissionApi.submitArenaSubmission({ userId: userB, enrollmentId }), "ENROLLMENT_NOT_FOUND");
  await rejectsWith(
    submissionApi.deleteArenaSubmissionItem({ userId: userB, enrollmentId, itemId: "00000000-0000-4000-8000-000000000000" }),
    "ENROLLMENT_NOT_FOUND",
  );
  await rejectsWith(
    submissionApi.getArenaSubmissionDownload({ userId: userB, enrollmentId, itemId: "00000000-0000-4000-8000-000000000000" }),
    "ENROLLMENT_NOT_FOUND",
  );
  await rejectsWith(resultApi.getArenaResult({ userId: userB, enrollmentId }), "ENROLLMENT_NOT_FOUND");

  // Sanity: A still owns everything after the attack burst.
  const own = await submissionApi.getArenaSubmission({ userId: userA, enrollmentId });
  assert.equal(own.enrollmentId, enrollmentId);
});

test("phase 4S: storage keys are server-issued, filenames cannot smuggle paths", async (t) => {
  const ids = await setup();
  t.after(async () => {
    await cleanup(ids);
  });
  const { userA, projectId, fileReqId } = ids;
  const { enrollment } = await enrollmentApi.selectArenaProject({ userId: userA, projectId });

  for (const bad of ["../evil.pdf", "/abs.pdf", "..\\win.pdf", "a".repeat(300) + ".pdf", "", "   "]) {
    await rejectsWith(
      submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: fileReqId, filename: bad, mimeType: "application/pdf", sizeBytes: 10 } }),
      "VALIDATION_ERROR",
    );
  }
  // Misleading double extension is inert: key must never contain the filename.
  const intent = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: fileReqId, filename: "report.pdf.exe", mimeType: "application/pdf", sizeBytes: 11 } });
  assert.match(intent.intentId, /^[0-9a-f-]{36}$/);
  const [row] = await sql`select storage_key from arena.upload_intents where id = ${intent.intentId}`;
  assert.match(row.storage_key, /^arena\/[a-z]+\/[0-9a-f-]{36}$/);
  assert.ok(!row.storage_key.includes("report"), "object key must not derive from filename");
  await sql`delete from arena.upload_intents where id = ${intent.intentId}`;

  await rejectsWith(
    submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: fileReqId, filename: "x.pdf", mimeType: "application/x-sh", sizeBytes: 10 } }),
    "VALIDATION_ERROR",
  );
  await rejectsWith(
    submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: fileReqId, filename: "big.pdf", mimeType: "application/pdf", sizeBytes: 21 * 1024 * 1024 } }),
    "VALIDATION_ERROR",
  );
  await rejectsWith(
    submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: fileReqId, filename: "zero.pdf", mimeType: "application/pdf", sizeBytes: 0 } }),
    "VALIDATION_ERROR",
  );
});

test("phase 4S: finalize rejects foreign, double, expired, and mismatched uploads", async (t) => {
  const ids = await setup();
  t.after(async () => {
    await cleanup(ids);
  });
  const { userA, userB, projectId, fileReqId } = ids;
  const a = await enrollmentApi.selectArenaProject({ userId: userA, projectId });
  const bEnroll = await enrollmentApi.selectArenaProject({ userId: userB, projectId });

  // Cross-enrollment intent theft: B uses their OWN enrollment but A's intent id.
  const foreign = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: a.enrollment.id, input: { requirementId: fileReqId, filename: "a.pdf", mimeType: "application/pdf", sizeBytes: 9 } });
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userB, enrollmentId: bEnroll.enrollment.id, intentId: foreign.intentId }),
    "UPLOAD_INTENT_NOT_FOUND",
  );
  await sql`delete from arena.upload_intents where id = ${foreign.intentId}`;

  // Live object, wrong size: server HEAD must refuse and clean up the object.
  const mismatch = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: a.enrollment.id, input: { requirementId: fileReqId, filename: "m.pdf", mimeType: "application/pdf", sizeBytes: 10 } });
  const [mrow] = await sql`select storage_key from arena.upload_intents where id = ${mismatch.intentId}`;
  orphanKeys.push(mrow.storage_key);
  await fetch(mismatch.uploadUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: "12345" });
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: a.enrollment.id, intentId: mismatch.intentId }),
    "UPLOAD_VALIDATION_FAILED",
  );

  // Expired intent cannot be finalized.
  const stale = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: a.enrollment.id, input: { requirementId: fileReqId, filename: "s.pdf", mimeType: "application/pdf", sizeBytes: 5 } });
  await sql`update arena.upload_intents set expires_at = now() - interval '1 minute' where id = ${stale.intentId}`;
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: a.enrollment.id, intentId: stale.intentId }),
    "UPLOAD_INTENT_EXPIRED",
  );
  await sql`delete from arena.upload_intents where id = ${stale.intentId}`;

  // Double finalize: exactly one wins.
  const twice = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: a.enrollment.id, input: { requirementId: fileReqId, filename: "t.pdf", mimeType: "application/pdf", sizeBytes: 5 } });
  const [trow] = await sql`select storage_key from arena.upload_intents where id = ${twice.intentId}`;
  orphanKeys.push(trow.storage_key);
  await fetch(twice.uploadUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: "12345" });
  // Kill-switch closed: finalize and draft delete freeze, consuming nothing.
  const frozen = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: a.enrollment.id, input: { requirementId: fileReqId, filename: "f.pdf", mimeType: "application/pdf", sizeBytes: 5 } });
  await sql`insert into ops.feature_flags (key, maintenance_mode, message) values ('arena-submissions', true, 'P4S maintenance')
    on conflict (key) do update set maintenance_mode = true, message = 'P4S maintenance'`;
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: a.enrollment.id, intentId: frozen.intentId }),
    "FEATURE_CLOSED",
  );
  await rejectsWith(
    submissionApi.deleteArenaSubmissionItem({ userId: userA, enrollmentId: a.enrollment.id, itemId: "00000000-0000-4000-8000-000000000000" }),
    "FEATURE_CLOSED",
  );
  await sql`delete from ops.feature_flags where key = 'arena-submissions'`;
  await sql`delete from arena.upload_intents where id = ${frozen.intentId}`;

  // Double finalize, sequential: consumed intent is invisible → NOT_FOUND.
  const item = await submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: a.enrollment.id, intentId: twice.intentId });
  assert.ok(item.id, "first finalize wins");
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: a.enrollment.id, intentId: twice.intentId }),
    "UPLOAD_INTENT_NOT_FOUND",
  );
  await submissionApi.deleteArenaSubmissionItem({ userId: userA, enrollmentId: a.enrollment.id, itemId: item.id });

  // Double finalize, concurrent: atomic consume lets exactly one through.
  const race = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: a.enrollment.id, input: { requirementId: fileReqId, filename: "r.pdf", mimeType: "application/pdf", sizeBytes: 5 } });
  const [rrow] = await sql`select storage_key from arena.upload_intents where id = ${race.intentId}`;
  orphanKeys.push(rrow.storage_key);
  await fetch(race.uploadUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: "12345" });
  const fr = await Promise.allSettled([
    submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: a.enrollment.id, intentId: race.intentId }),
    submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: a.enrollment.id, intentId: race.intentId }),
  ]);
  assert.equal(fr.filter((o) => o.status === "fulfilled").length, 1, "exactly one concurrent finalize wins");
  const frLost = fr.filter((o) => o.status === "rejected");
  assert.equal(frLost.length, 1);
  assert.ok(["UPLOAD_INTENT_EXPIRED", "UPLOAD_INTENT_NOT_FOUND"].includes(frLost[0].reason?.code));
});

test("phase 4S: versions are immutable snapshots; draft churn cannot rewrite history", async (t) => {
  const ids = await setup();
  t.after(async () => {
    await cleanup(ids);
  });
  const { userA, projectId, linkReqId } = ids;
  const { enrollment } = await enrollmentApi.selectArenaProject({ userId: userA, projectId });

  await submissionApi.addArenaSubmissionLink({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: linkReqId, url: "https://example.com/" } });
  const first = await submissionApi.submitArenaSubmission({ userId: userA, enrollmentId: enrollment.id });
  // Environment-tolerant: reachable link → attempt 1; blocked env → FAILED + zero attempts.
  if (first.version.accessStatus === "ACCESSIBLE") {
    assert.equal(first.version.reviewAttemptNumber, 1);
  } else {
    assert.equal(first.version.reviewAttemptNumber, null);
  }
  const [v1item] = await sql`
    select external_url from arena.submission_version_items
    where submission_version_id = ${first.version.id} order by id limit 1`;
  assert.equal(v1item.external_url, "https://example.com/");

  // Attack the draft: delete the link, add a different one, change text, submit again.
  const draft = await submissionApi.getArenaSubmission({ userId: userA, enrollmentId: enrollment.id });
  for (const item of draft.items) {
    await submissionApi.deleteArenaSubmissionItem({ userId: userA, enrollmentId: enrollment.id, itemId: item.id });
  }
  await submissionApi.patchArenaSubmissionDraft({ userId: userA, enrollmentId: enrollment.id, input: { explanation: "rewritten" } });
  await submissionApi.addArenaSubmissionLink({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: linkReqId, url: "https://github.com/" } });
  const second = await submissionApi.submitArenaSubmission({ userId: userA, enrollmentId: enrollment.id });
  if (second.version.accessStatus === "ACCESSIBLE") {
    assert.equal(second.version.reviewAttemptNumber, (first.version.reviewAttemptNumber ?? 0) + 1);
  }

  const [v1again] = await sql`
    select external_url from arena.submission_version_items
    where submission_version_id = ${first.version.id} order by id limit 1`;
  assert.equal(v1again.external_url, "https://example.com/", "v1 snapshot must survive draft churn");
  const versions = await sql`select version_number, review_attempt_number from arena.submission_versions where submission_id = ${draft.id} order by version_number`;
  assert.deepEqual(versions.map((v) => v.version_number), [1, 2]);
  assert.ok(versions.every((v) => v.review_attempt_number === null || v.review_attempt_number > 0));
});

test("phase 4S: concurrent submits get unique versions; attempt #3 race has exactly one winner", async (t) => {
  const ids = await setup();
  t.after(async () => {
    await cleanup(ids);
  });
  const { userA, userB, projectId, linkReqId } = ids;
  const a = await enrollmentApi.selectArenaProject({ userId: userA, projectId });
  const b = await enrollmentApi.selectArenaProject({ userId: userB, projectId });

  // Race 1: two simultaneous valid submits on a fresh submission.
  // Both must complete with distinct versions — never a raw 500.
  await submissionApi.addArenaSubmissionLink({ userId: userA, enrollmentId: a.enrollment.id, input: { requirementId: linkReqId, url: "https://example.com/" } });
  const [r1, r2] = await Promise.all([
    submissionApi.submitArenaSubmission({ userId: userA, enrollmentId: a.enrollment.id }),
    submissionApi.submitArenaSubmission({ userId: userA, enrollmentId: a.enrollment.id }),
  ]);
  assert.notEqual(r1.version.id, r2.version.id, "parallel submits must mint distinct versions");
  const pair = [r1.version.reviewAttemptNumber, r2.version.reviewAttemptNumber].sort();
  assert.ok(
    JSON.stringify(pair) === JSON.stringify([1, 2]) || JSON.stringify(pair) === JSON.stringify([null, null]),
    `expected attempts [1,2] (or [null,null] when the probe is blocked), got ${JSON.stringify(pair)}`,
  );

  // Race 2: used=2, two simultaneous valid submits → exactly one attempt #3.
  // Requires a genuinely reachable link; skip loudly when the probe is blocked.
  const { checkExternalUrlAccess } = await import("../src/server/submissions/url-access.ts");
  const probe = await checkExternalUrlAccess("https://example.com/");
  if (!probe.accessible) {
    console.log("SKIP attempt-3 race: link probe blocked in this environment");
    return;
  }
  await submissionApi.addArenaSubmissionLink({ userId: userB, enrollmentId: b.enrollment.id, input: { requirementId: linkReqId, url: "https://example.com/" } });
  await sql`update arena.submissions set review_attempts_used = 2 where enrollment_id = ${b.enrollment.id}`;
  const outcomes = await Promise.allSettled([
    submissionApi.submitArenaSubmission({ userId: userB, enrollmentId: b.enrollment.id }),
    submissionApi.submitArenaSubmission({ userId: userB, enrollmentId: b.enrollment.id }),
  ]);
  const won = outcomes.filter((o) => o.status === "fulfilled");
  const lost = outcomes.filter((o) => o.status === "rejected");
  assert.equal(won.length, 1, "exactly one racer may take attempt #3");
  assert.equal(lost.length, 1);
  assert.equal(lost[0].reason?.code, "REVIEW_ATTEMPT_LIMIT_REACHED");
  assert.equal(won[0].value.version.reviewAttemptNumber, 3);
  const [sub] = await sql`select review_attempts_used from arena.submissions where enrollment_id = ${b.enrollment.id}`;
  assert.equal(sub.review_attempts_used, 3, "attempt #4 must be impossible");
});

test("phase 4S: technical failure consumes zero attempts; retry consumes exactly one", async (t) => {
  const ids = await setup();
  t.after(async () => {
    await cleanup(ids);
  });
  const { userC, projectId, linkReqId } = ids;
  const { enrollment } = await enrollmentApi.selectArenaProject({ userId: userC, projectId });

  await submissionApi.addArenaSubmissionLink({ userId: userC, enrollmentId: enrollment.id, input: { requirementId: linkReqId, url: "https://nonexistent-domain-p4s.test/dead" } });
  const failed = await submissionApi.submitArenaSubmission({ userId: userC, enrollmentId: enrollment.id });
  assert.equal(failed.version.accessStatus, "FAILED");
  assert.equal(failed.version.reviewAttemptNumber, null);
  const [mid] = await sql`select review_attempts_used from arena.submissions where enrollment_id = ${enrollment.id}`;
  assert.equal(mid.review_attempts_used, 0, "technical failure must not consume an attempt");

  const draft = await submissionApi.getArenaSubmission({ userId: userC, enrollmentId: enrollment.id });
  for (const item of draft.items) {
    await submissionApi.deleteArenaSubmissionItem({ userId: userC, enrollmentId: enrollment.id, itemId: item.id });
  }
  await submissionApi.addArenaSubmissionLink({ userId: userC, enrollmentId: enrollment.id, input: { requirementId: linkReqId, url: "https://example.com/" } });
  const retry = await submissionApi.submitArenaSubmission({ userId: userC, enrollmentId: enrollment.id });
  if (retry.version.accessStatus === "ACCESSIBLE") {
    assert.equal(retry.version.reviewAttemptNumber, 1);
    const [end] = await sql`select review_attempts_used from arena.submissions where enrollment_id = ${enrollment.id}`;
    assert.equal(end.review_attempts_used, 1, "retry consumes exactly one attempt");
  } else {
    const [end] = await sql`select review_attempts_used from arena.submissions where enrollment_id = ${enrollment.id}`;
    assert.equal(end.review_attempts_used, 0, "blocked probe must still consume zero attempts");
  }
});

test("phase 4S: server clock owns the deadline on every mutation", async (t) => {
  const ids = await setup();
  t.after(async () => {
    await cleanup(ids);
  });
  const { userA, projectId, linkReqId, fileReqId, deadline } = ids;
  const { enrollment } = await enrollmentApi.selectArenaProject({ userId: userA, projectId });
  const late = new Date(new Date(deadline).getTime() + 1_000);

  await rejectsWith(
    workspaceApi.patchArenaWorkspace({ userId: userA, enrollmentId: enrollment.id, input: { notes: "late" }, now: late }),
    "SELECTION_DEADLINE_PASSED",
  );
  await rejectsWith(
    submissionApi.patchArenaSubmissionDraft({ userId: userA, enrollmentId: enrollment.id, input: { explanation: "late" }, now: late }),
    "SUBMISSION_DEADLINE_PASSED",
  );
  await rejectsWith(
    submissionApi.addArenaSubmissionLink({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: linkReqId, url: "https://example.com/late" }, now: late }),
    "SUBMISSION_DEADLINE_PASSED",
  );
  await rejectsWith(
    submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: fileReqId, filename: "late.pdf", mimeType: "application/pdf", sizeBytes: 5 }, now: late }),
    "SUBMISSION_DEADLINE_PASSED",
  );
  const intent = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollment.id, input: { requirementId: fileReqId, filename: "ontime.pdf", mimeType: "application/pdf", sizeBytes: 7 } });
  const [irow] = await sql`select storage_key from arena.upload_intents where id = ${intent.intentId}`;
  orphanKeys.push(irow.storage_key);
  await fetch(intent.uploadUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: "1234567" });
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: enrollment.id, intentId: intent.intentId, now: late }),
    "SUBMISSION_DEADLINE_PASSED",
  );
  await rejectsWith(
    submissionApi.submitArenaSubmission({ userId: userA, enrollmentId: enrollment.id, now: late }),
    "SUBMISSION_DEADLINE_PASSED",
  );
  await sql`delete from arena.upload_intents where id = ${intent.intentId}`;
});
