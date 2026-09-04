import assert from "node:assert/strict";
import test, { after } from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

assert.equal(process.env.APP_ENV, "development", "Upload flow tests require APP_ENV=development");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

// Live DEV database + live private Tencent COS. Tiny disposable objects only.
const submissionApi = await import("../src/server/submissions/service.ts");
const storageApi = await import("../src/server/storage/upload.ts");

const stamp = Date.now();
const WEEK_CODE = `P9B-${stamp}`;
const DIVISION_SLUG = `p9b-div-${stamp}`;
const PROJECT_SLUG = `p9b-project-${stamp}`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const orphanKeys = [];

after(async () => {
  const storage = await import("../src/server/storage/upload.ts");
  for (const key of orphanKeys) {
    await storage.deletePrivateObject(key).catch(() => undefined);
  }
  await sql.end({ timeout: 5 });
});

async function setup() {
  const [userA] = await sql`insert into identity.users (auth_subject) values (${`p9b-a-${stamp}`}) returning id`;
  const [userB] = await sql`insert into identity.users (auth_subject) values (${`p9b-b-${stamp}`}) returning id`;
  const now = new Date();
  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${WEEK_CODE}, 'P9B Week', 'OPEN', ${new Date(now.getTime() - 5 * 60_000)}, ${new Date(now.getTime() + 2 * 60 * 60_000)}, 'Asia/Jakarta')
    returning id`;
  await sql`insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission) values (${week.id}, 1, 3, false)`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, description, is_active, sort_order)
    values (${DIVISION_SLUG}, 'P9B Division', 'upload flow fixture', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at)
    values (${week.id}, ${division.id}, ${PROJECT_SLUG}, 'P9B Project', 'upload flow fixture', 'PUBLISHED', ${now}) returning id`;
  const [linkReq] = await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Work links', 'LINK', false, 0, 5, 'Optional links.', 0) returning id`;
  const [fileReq] = await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Work files', 'FILE', false, 0, 5, 'Optional files.', 0) returning id`;
  const enrollmentApi = await import("../src/server/arena/enrollment-service.ts");
  const a = await enrollmentApi.selectArenaProject({ userId: userA.id, projectId: project.id });
  const b = await enrollmentApi.selectArenaProject({ userId: userB.id, projectId: project.id });
  return { userA: userA.id, userB: userB.id, enrollmentA: a.enrollment.id, enrollmentB: b.enrollment.id, linkReqId: linkReq.id, fileReqId: fileReq.id };
}

async function cleanup(ids) {
  for (const userId of [ids.userA, ids.userB]) {
    const enrollments = await sql`select id from arena.enrollments where user_id = ${userId}`;
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
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${userId})`;
    await sql`delete from notifications.events where user_id = ${userId}`;
    await sql`delete from identity.sessions where user_id = ${userId}`;
    await sql`delete from identity.users where id = ${userId}`;
  }
  const [project] = await sql`select id from arena.projects where slug = ${PROJECT_SLUG}`;
  if (project) {
    await sql`delete from arena.project_submission_requirements where project_id = ${project.id}`;
    await sql`delete from arena.projects where id = ${project.id}`;
  }
  await sql`delete from arena.divisions where slug = ${DIVISION_SLUG}`;
  const [week] = await sql`select id from arena.weeks where week_code = ${WEEK_CODE}`;
  if (week) {
    await sql`delete from arena.week_rules where week_id = ${week.id}`;
    await sql`delete from arena.weeks where id = ${week.id}`;
  }
  await sql`delete from ops.feature_flags where key = 'arena-submissions'`;
}

async function rejectsWith(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.code, code, `expected ${code}, got ${error?.code}: ${error?.message}`);
    return true;
  });
}

async function uploadBytes(intent, body, mime = "application/pdf") {
  const put = await fetch(intent.uploadUrl, { method: "PUT", headers: { "content-type": mime }, body });
  assert.ok(put.ok, `COS PUT failed: HTTP ${put.status}`);
}

test("upload flow: supported file accepted; type/size/key attacks rejected", async (t) => {
  const ids = await setup();
  t.after(async () => cleanup(ids));
  const { userA, enrollmentA, fileReqId } = ids;

  const intent = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename: "portfolio.pdf", mimeType: "application/pdf", sizeBytes: 9 } });
  const [row] = await sql`select storage_key from arena.upload_intents where id = ${intent.intentId}`;
  orphanKeys.push(row.storage_key);
  await uploadBytes(intent, "123456789");
  const item = await submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: enrollmentA, intentId: intent.intentId });
  assert.equal(item.originalFilename, "portfolio.pdf");
  assert.equal(item.fileSizeBytes, 9);

  await rejectsWith(
    submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename: "evil.exe", mimeType: "application/x-msdownload", sizeBytes: 10 } }),
    "VALIDATION_ERROR",
  );
  await rejectsWith(
    submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename: "huge.pdf", mimeType: "application/pdf", sizeBytes: 21 * 1024 * 1024 } }),
    "VALIDATION_ERROR",
  );
  // Strict schema: client-supplied storage key is not a known field.
  await rejectsWith(
    submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename: "k.pdf", mimeType: "application/pdf", sizeBytes: 5, storageKey: "arena/production/stolen" } }),
    "VALIDATION_ERROR",
  );
});

test("upload flow: sixth file rejected; incomplete upload never joins the draft", async (t) => {
  const ids = await setup();
  t.after(async () => cleanup(ids));
  const { userA, enrollmentA, fileReqId } = ids;

  async function presignAndPut(filename) {
    const intent = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename, mimeType: "application/pdf", sizeBytes: 3 } });
    const [r] = await sql`select storage_key from arena.upload_intents where id = ${intent.intentId}`;
    orphanKeys.push(r.storage_key);
    await uploadBytes(intent, "abc");
    return intent;
  }

  for (let i = 0; i < 4; i += 1) {
    const intent = await presignAndPut(`f${i}.pdf`);
    await submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: enrollmentA, intentId: intent.intentId });
  }

  // Bytes are in the bucket but finalize never ran: invisible to the draft, and it holds no slot.
  const ghost = await presignAndPut("ghost.pdf");
  const midDraft = await submissionApi.getArenaSubmission({ userId: userA, enrollmentId: enrollmentA });
  assert.equal(midDraft.items.filter((item) => item.itemType === "FILE").length, 4);

  const fifth = await presignAndPut("f4.pdf");
  await submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: enrollmentA, intentId: fifth.intentId });
  const draft = await submissionApi.getArenaSubmission({ userId: userA, enrollmentId: enrollmentA });
  assert.equal(draft.items.filter((item) => item.itemType === "FILE").length, 5);

  await rejectsWith(
    submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename: "f5.pdf", mimeType: "application/pdf", sizeBytes: 3 } }),
    "FILE_LIMIT_EXCEEDED",
  );
  // The stale ghost cannot smuggle in a sixth file after the cap is reached.
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: enrollmentA, intentId: ghost.intentId }),
    "FILE_LIMIT_EXCEEDED",
  );
  const stillFive = await submissionApi.getArenaSubmission({ userId: userA, enrollmentId: enrollmentA });
  assert.equal(stillFive.items.filter((item) => item.itemType === "FILE").length, 5);
  await sql`delete from arena.upload_intents where id = ${ghost.intentId}`;
});

test("upload flow: failed finalize retries clean; mixed files+links submit immutably", async (t) => {
  const ids = await setup();
  t.after(async () => cleanup(ids));
  const { userA, enrollmentA, linkReqId, fileReqId } = ids;

  // Wrong byte count: refused, object removed, zero attempts consumed.
  const bad = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename: "bad.pdf", mimeType: "application/pdf", sizeBytes: 10 } });
  const [brow] = await sql`select storage_key from arena.upload_intents where id = ${bad.intentId}`;
  orphanKeys.push(brow.storage_key);
  await uploadBytes(bad, "12345");
  await rejectsWith(
    submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: enrollmentA, intentId: bad.intentId }),
    "UPLOAD_VALIDATION_FAILED",
  );
  const [mid] = await sql`select review_attempts_used from arena.submissions where enrollment_id = ${enrollmentA}`;
  assert.equal(mid?.review_attempts_used ?? 0, 0);

  // Fresh intent succeeds; exactly one draft item exists (no duplicate).
  const good = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename: "good.pdf", mimeType: "application/pdf", sizeBytes: 5 } });
  const [grow2] = await sql`select storage_key from arena.upload_intents where id = ${good.intentId}`;
  orphanKeys.push(grow2.storage_key);
  await uploadBytes(good, "12345");
  await submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: enrollmentA, intentId: good.intentId });
  await submissionApi.addArenaSubmissionLink({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: linkReqId, url: "https://example.com/" } });

  // Refresh restores the same draft attachments from the server.
  const draft = await submissionApi.getArenaSubmission({ userId: userA, enrollmentId: enrollmentA });
  assert.equal(draft.items.filter((i) => i.itemType === "FILE").length, 1);
  assert.equal(draft.items.filter((i) => i.itemType === "LINK").length, 1);

  const first = await submissionApi.submitArenaSubmission({ userId: userA, enrollmentId: enrollmentA });
  assert.equal(first.version.accessStatus, "ACCESSIBLE");
  assert.equal(first.version.reviewAttemptNumber, 1);

  // Draft churn after submit cannot rewrite v1; v2 snapshots the new mix.
  const fileItem = draft.items.find((i) => i.itemType === "FILE");
  await submissionApi.deleteArenaSubmissionItem({ userId: userA, enrollmentId: enrollmentA, itemId: fileItem.id });
  // Referenced object survives the draft delete (retention guard).
  await storageApi.headPrivateObject(grow2.storage_key);
  const again = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename: "v2.pdf", mimeType: "application/pdf", sizeBytes: 4 } });
  const [arow] = await sql`select storage_key from arena.upload_intents where id = ${again.intentId}`;
  orphanKeys.push(arow.storage_key);
  await uploadBytes(again, "1234");
  await submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: enrollmentA, intentId: again.intentId });
  const second = await submissionApi.submitArenaSubmission({ userId: userA, enrollmentId: enrollmentA });
  assert.equal(second.version.reviewAttemptNumber, 2);
  const v1rows = await sql`select original_filename from arena.submission_version_items where submission_version_id = ${first.version.id} order by id`;
  assert.deepEqual(v1rows.map((r) => r.original_filename).sort(), ["good.pdf", null].sort());
});

test("upload flow: foreign user cannot download or attach victim objects", async (t) => {
  const ids = await setup();
  t.after(async () => cleanup(ids));
  const { userA, userB, enrollmentA, enrollmentB, fileReqId } = ids;

  const intent = await submissionApi.createArenaUploadIntent({ userId: userA, enrollmentId: enrollmentA, input: { requirementId: fileReqId, filename: "secret.pdf", mimeType: "application/pdf", sizeBytes: 6 } });
  const [srow] = await sql`select storage_key from arena.upload_intents where id = ${intent.intentId}`;
  orphanKeys.push(srow.storage_key);
  await uploadBytes(intent, "123456");
  const item = await submissionApi.finalizeArenaUpload({ userId: userA, enrollmentId: enrollmentA, intentId: intent.intentId });

  await rejectsWith(
    submissionApi.getArenaSubmissionDownload({ userId: userB, enrollmentId: enrollmentA, itemId: item.id }),
    "ENROLLMENT_NOT_FOUND",
  );
  await rejectsWith(
    submissionApi.getArenaSubmissionDownload({ userId: userB, enrollmentId: enrollmentB, itemId: item.id }),
    "SUBMISSION_ITEM_NOT_FOUND",
  );
  await rejectsWith(
    submissionApi.deleteArenaSubmissionItem({ userId: userB, enrollmentId: enrollmentB, itemId: item.id }),
    "SUBMISSION_ITEM_NOT_FOUND",
  );
  // Owner download grant is a short-lived signature, never a permanent or credentialed URL.
  const grant = await submissionApi.getArenaSubmissionDownload({ userId: userA, enrollmentId: enrollmentA, itemId: item.id });
  assert.equal(grant.filename, "secret.pdf");
  const grantUrl = new URL(grant.url);
  assert.equal(grantUrl.protocol, "https:");
  assert.ok(grantUrl.searchParams.get("X-Amz-Signature"), "download grant must be signed");
  const ttl = Number(grantUrl.searchParams.get("X-Amz-Expires"));
  assert.ok(ttl > 0 && ttl <= 900, `download grant TTL must be short-lived, got ${ttl}s`);
  const cosSecretKey = process.env.TENCENT_COS_SECRET_KEY;
  assert.ok(cosSecretKey, "TENCENT_COS_SECRET_KEY must be configured");
  assert.ok(!grant.url.includes(cosSecretKey), "download grant must never carry the secret key");

  // The signature works; the same object without it stays private.
  const signedGet = await fetch(grant.url);
  assert.ok(signedGet.ok, `signed GET failed: HTTP ${signedGet.status}`);
  assert.equal(await signedGet.text(), "123456");
  const anonymousGet = await fetch(`${grantUrl.origin}${grantUrl.pathname}`);
  assert.equal(anonymousGet.ok, false, "object must not be publicly readable");
  assert.ok([401, 403, 404].includes(anonymousGet.status), `anonymous GET should be denied, got ${anonymousGet.status}`);
});
