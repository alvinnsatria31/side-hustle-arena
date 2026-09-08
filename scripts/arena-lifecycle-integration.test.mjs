/**
 * The Arena lifecycle, end to end, against the local sandbox.
 *
 * This replaces `scripts/true-e2e-test.mjs`, which called itself a true
 * business end-to-end test while: never uploading a file, hardcoding sandbox
 * credentials and a session secret in the source, claiming whatever job
 * happened to be at the head of the GLOBAL review queue (so two runs, or a
 * developer's leftover data, could grade each other's work), downgrading a
 * points mismatch to "INFO" so the run still reported ALL PASSED, leaving every
 * fixture row and object behind, and calling `process.exit` to paper over it.
 *
 * What it is now:
 *   - a real `node:test` suite, so a failed assertion fails the run;
 *   - credentials come from the generated sandbox env file, never the source;
 *   - the upload is a genuine presigned PUT to the sandbox object store;
 *   - the review claims THIS run's job by id, never the queue head;
 *   - every fixture row and object is removed afterwards, pass or fail.
 *
 * It needs the local sandbox running (`node scripts/local-dev.mjs --setup-only`)
 * and touches nothing outside it: no live database, bucket, AI provider, email
 * or webhook. Excluded from `npm run test:offline` automatically, because it
 * reads DATABASE_URL.
 */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { localEnvironment } from "./local-env.mjs";

// The sandbox env must be in place before any server module is imported: the
// storage and database clients read configuration at module scope.
const sandbox = localEnvironment();
for (const [key, value] of Object.entries(sandbox)) process.env[key] = value;
// Evidence extraction is gated on the review provider profile. The stub
// provider is what grades here, but the extraction path — download, checksum
// verification, text snapshot — is the one production uses, and it is the part
// A01 changed, so the suite exercises it rather than skipping it.
process.env.AI_REVIEW_PROVIDER = "openai-compatible";

assert.equal(process.env.ARENA_LOCAL_SANDBOX, "1");
assert.match(process.env.DATABASE_URL, /127\.0\.0\.1|localhost/);

const { getDb } = await import("../src/server/db/client.ts");
const schema = await import("../src/server/db/schema/index.ts");
const { eq, inArray } = await import("drizzle-orm");
const { selectArenaProject } = await import("../src/server/arena/enrollment-service.ts");
const { patchArenaWorkspace } = await import("../src/server/arena/workspace-service.ts");
const submissionApi = await import("../src/server/submissions/service.ts");
const { claimReviewJob, completeReviewJob } = await import("../src/server/reviews/queue-service.ts");
const { StubReviewProvider } = await import("../src/server/reviews/model-router.ts");
const { closeWeekForFinalization, finalizeWeek } = await import("../src/server/finalization/service.ts");
const { deletePrivateObject, headPrivateObject, createPresignedUpload } = await import("../src/server/storage/upload.ts");
const { downloadObjectBytes } = await import("../src/server/storage/integrity.ts");

const db = getDb();
const STAMP = `it-${Date.now()}-${randomUUID().slice(0, 8)}`;

// A real deliverable, not a stub: the upload path checks the content signature
// and the review path extracts text from it, so the bytes have to be a genuine
// parseable CSV rather than something merely shaped like one.
const SUBMITTED = Buffer.from([
  "channel,revenue,cost,margin",
  "online,120000,090000,30000",
  "retail,080000,062000,18000",
  "reseller,45000,033000,12000",
].join("\n") + "\n");
// Same byte length, different content — the replay an attacker would use, and
// the reason a size check is not an identity check.
const SWAPPED = Buffer.from(SUBMITTED);
SWAPPED.write("999999", SUBMITTED.indexOf("120000"));

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Everything this run created, torn down in reverse dependency order. */
const fixture = { objects: new Set(), userId: null, weekId: null, divisionId: null, projectId: null, skillId: null };

async function uploadTo(url, body) {
  const response = await fetch(url, { method: "PUT", headers: { "content-type": "text/csv" }, body });
  assert.ok(response.ok, `presigned PUT failed: HTTP ${response.status} ${await response.text()}`);
}

before(async () => {
  const [user] = await db.insert(schema.users).values({ authSubject: `${STAMP}-participant` }).returning();
  fixture.userId = user.id;
  const [division] = await db.insert(schema.divisions).values({
    // Active on purpose: project selection refuses a project whose division is
    // inactive, so an "isolated" inactive division would test nothing. The
    // cleanup below removes it again, pass or fail.
    slug: `${STAMP}-division`, name: `${STAMP} Division`, description: "Local integration fixture", isActive: true, sortOrder: 9999,
  }).returning();
  fixture.divisionId = division.id;
  const [skill] = await db.insert(schema.skills).values({ slug: `${STAMP}-skill`, name: `${STAMP} Skill` }).returning();
  fixture.skillId = skill.id;

  const now = new Date();
  const [week] = await db.insert(schema.weeks).values({
    weekCode: STAMP, title: `${STAMP} Week`, status: "OPEN",
    opensAt: now, submissionDeadlineAt: new Date(now.getTime() + 2 * 3600_000), timezone: "Asia/Jakarta",
  }).returning();
  fixture.weekId = week.id;
  await db.insert(schema.weekRules).values({ weekId: week.id, maxProjectsPerUser: 1, maxReviewAttempts: 3, allowLateSubmission: false });

  const [project] = await db.insert(schema.projects).values({
    weekId: week.id, divisionId: division.id, slug: `${STAMP}-project`, title: `${STAMP} Project`,
    shortDescription: "Local integration fixture project", caseBackground: "Fixture case background",
    roleDescription: "Fixture role", objective: "Fixture objective", mission: "Fixture mission",
    status: "PUBLISHED", publishedAt: now, estimatedMinutes: 120, difficulty: "STANDARD",
  }).returning();
  fixture.projectId = project.id;
  await db.insert(schema.projectSkills).values({ projectId: project.id, skillId: skill.id, weight: "1.00" });

  // FILE only. A LINK requirement would make the submit path depend on
  // reaching a real host, which is exactly the kind of hidden external
  // dependency this harness exists to avoid.
  const [fileRequirement] = await db.insert(schema.projectSubmissionRequirements).values({
    projectId: project.id, label: "Margin table", type: "FILE", required: true, minItems: 1, maxItems: 1,
    allowedMimeTypes: ["text/csv"], instructions: "Upload the per-channel margin table as CSV.", sortOrder: 0,
  }).returning();
  fixture.requirementId = fileRequirement.id;

  for (const [index, name] of ["Completeness", "Quality"].entries()) {
    await db.insert(schema.projectRubricCriteria).values({
      projectId: project.id, name, description: `${name} of the delivered analysis`,
      weight: "1.00", maxScore: 100, sortOrder: index,
      reviewInstruction: `Assess the ${name.toLowerCase()} of the submitted work.`,
    });
  }
});

after(async () => {
  // Runs on failure too: a half-finished run must not leave rows that another
  // suite (or the next run of this one) could pick up.
  for (const key of fixture.objects) await deletePrivateObject(key).catch(() => undefined);
  if (fixture.weekId) {
    const versions = await db.select({ id: schema.submissionVersions.id })
      .from(schema.submissionVersions)
      .innerJoin(schema.submissions, eq(schema.submissions.id, schema.submissionVersions.submissionId))
      .where(eq(schema.submissions.weekId, fixture.weekId));
    const versionIds = versions.map((row) => row.id);
    // Rankings first: they hold a foreign key to the review rows below.
    await db.delete(schema.weeklyRankings).where(eq(schema.weeklyRankings.weekId, fixture.weekId));
    if (versionIds.length) {
      const reviewRows = await db.select({ id: schema.reviews.id }).from(schema.reviews)
        .where(inArray(schema.reviews.submissionVersionId, versionIds));
      const reviewIds = reviewRows.map((row) => row.id);
      if (reviewIds.length) {
        await db.delete(schema.reviewScores).where(inArray(schema.reviewScores.reviewId, reviewIds));
        await db.delete(schema.skillEvidence).where(inArray(schema.skillEvidence.reviewId, reviewIds));
      }
      await db.delete(schema.reviews).where(inArray(schema.reviews.submissionVersionId, versionIds));
      await db.delete(schema.reviewArtifacts).where(inArray(schema.reviewArtifacts.submissionVersionId, versionIds));
      await db.delete(schema.reviewJobs).where(inArray(schema.reviewJobs.submissionVersionId, versionIds));
      await db.delete(schema.submissionVersionItems).where(inArray(schema.submissionVersionItems.submissionVersionId, versionIds));
    }
  }
  if (fixture.userId) {
    await db.delete(schema.pointLedger).where(eq(schema.pointLedger.userId, fixture.userId));
    await db.delete(schema.pointAccounts).where(eq(schema.pointAccounts.userId, fixture.userId));
    const eventRows = await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.userId, fixture.userId));
    if (eventRows.length) {
      await db.delete(schema.deliveries).where(inArray(schema.deliveries.eventId, eventRows.map((row) => row.id)));
    }
    await db.delete(schema.events).where(eq(schema.events.userId, fixture.userId));
    await db.delete(schema.uploadIntents).where(eq(schema.uploadIntents.userId, fixture.userId));
  }
  if (fixture.weekId) {
    const submissionRows = await db.select({ id: schema.submissions.id, enrollmentId: schema.submissions.enrollmentId })
      .from(schema.submissions).where(eq(schema.submissions.weekId, fixture.weekId));
    for (const row of submissionRows) {
      await db.delete(schema.submissionDraftItems).where(eq(schema.submissionDraftItems.submissionId, row.id));
      await db.delete(schema.submissionVersions).where(eq(schema.submissionVersions.submissionId, row.id));
    }
    await db.delete(schema.submissions).where(eq(schema.submissions.weekId, fixture.weekId));
    const enrollmentRows = await db.select({ id: schema.enrollments.id }).from(schema.enrollments)
      .where(eq(schema.enrollments.weekId, fixture.weekId));
    if (enrollmentRows.length) {
      await db.delete(schema.workspaceProgress).where(inArray(schema.workspaceProgress.enrollmentId, enrollmentRows.map((row) => row.id)));
    }
    await db.delete(schema.enrollments).where(eq(schema.enrollments.weekId, fixture.weekId));
  }
  if (fixture.projectId) {
    await db.delete(schema.projectRubricCriteria).where(eq(schema.projectRubricCriteria.projectId, fixture.projectId));
    await db.delete(schema.projectSubmissionRequirements).where(eq(schema.projectSubmissionRequirements.projectId, fixture.projectId));
    await db.delete(schema.projectSkills).where(eq(schema.projectSkills.projectId, fixture.projectId));
    await db.delete(schema.projects).where(eq(schema.projects.id, fixture.projectId));
  }
  if (fixture.weekId) {
    await db.delete(schema.weekRules).where(eq(schema.weekRules.weekId, fixture.weekId));
    await db.delete(schema.weeks).where(eq(schema.weeks.id, fixture.weekId));
  }
  if (fixture.skillId) await db.delete(schema.skills).where(eq(schema.skills.id, fixture.skillId));
  if (fixture.divisionId) await db.delete(schema.divisions).where(eq(schema.divisions.id, fixture.divisionId));
  if (fixture.userId) await db.delete(schema.users).where(eq(schema.users.id, fixture.userId));
});

test("a participant enrolls, works, uploads a real file and submits", async (t) => {
  const enrolled = await selectArenaProject({ userId: fixture.userId, projectId: fixture.projectId });
  fixture.enrollmentId = enrolled.enrollment.id;

  await patchArenaWorkspace({
    userId: fixture.userId, enrollmentId: fixture.enrollmentId,
    input: { currentStep: "PLAN", planText: "Clean the data, then compute margin per channel.", tools: ["Spreadsheet"], taskBreakdown: [{ title: "Clean data", done: true }], notes: "Fixture notes" },
  });

  const intent = await submissionApi.createArenaUploadIntent({
    userId: fixture.userId, enrollmentId: fixture.enrollmentId,
    input: { requirementId: fixture.requirementId, filename: "margin.csv", mimeType: "text/csv", sizeBytes: SUBMITTED.length },
  });
  await uploadTo(intent.uploadUrl, SUBMITTED);

  const item = await submissionApi.finalizeArenaUpload({
    userId: fixture.userId, enrollmentId: fixture.enrollmentId, intentId: intent.intentId,
  });
  // A01: the checksum of the bytes actually read is recorded at finalize.
  assert.equal(item.checksum, sha(SUBMITTED), "finalize must record the checksum of what it read");
  const [draft] = await db.select().from(schema.submissionDraftItems).where(eq(schema.submissionDraftItems.id, item.id));
  fixture.draftKey = draft.storageKey;
  fixture.objects.add(draft.storageKey);
  fixture.uploadUrl = intent.uploadUrl;

  await submissionApi.patchArenaSubmissionDraft({
    userId: fixture.userId, enrollmentId: fixture.enrollmentId,
    input: { explanation: "Saya menggabungkan tiga file penjualan menjadi satu tabel master lalu menghitung margin per kanal." },
  });

  const submitted = await submissionApi.submitArenaSubmission({ userId: fixture.userId, enrollmentId: fixture.enrollmentId });
  assert.equal(submitted.version.accessStatus, "ACCESSIBLE");
  assert.equal(submitted.allocatedReviewAttempt, true);
  assert.equal(submitted.version.reviewAttemptNumber, 1);
  fixture.versionId = submitted.version.id;
  t.diagnostic(`version ${fixture.versionId} submitted`);
});

test("the submitted version references a frozen snapshot, not the draft object", async () => {
  const items = await db.select().from(schema.submissionVersionItems)
    .where(eq(schema.submissionVersionItems.submissionVersionId, fixture.versionId));
  assert.equal(items.length, 1);
  const [versionItem] = items;
  fixture.snapshotKey = versionItem.storageKey;
  fixture.objects.add(versionItem.storageKey);

  assert.notEqual(versionItem.storageKey, fixture.draftKey, "a version item must not point at the overwritable draft key");
  assert.match(versionItem.storageKey, /^arena\/development\/snapshots\/[a-f0-9-]{36}$/);
  assert.equal(versionItem.checksum, sha(SUBMITTED));
  assert.equal(Number(versionItem.fileSizeBytes), SUBMITTED.length);
  // The snapshot really exists and really holds those bytes.
  const stored = await downloadObjectBytes(versionItem.storageKey, { expectedChecksum: versionItem.checksum });
  assert.deepEqual(stored.bytes, SUBMITTED);
});

test("replaying the presigned PUT with equal-size different bytes cannot change the review input", async () => {
  // The attack: the upload URL is still valid, and the replacement is byte-for
  // byte the same length, so every size check passes.
  await uploadTo(fixture.uploadUrl, SWAPPED);
  const draftNow = await downloadObjectBytes(fixture.draftKey);
  assert.deepEqual(draftNow.bytes, SWAPPED, "the draft object was indeed replaced — the premise of the test");

  const snapshot = await downloadObjectBytes(fixture.snapshotKey);
  assert.deepEqual(snapshot.bytes, SUBMITTED, "the frozen snapshot must be untouched by a replay on the draft key");
  assert.equal(snapshot.checksum, sha(SUBMITTED));
  assert.notEqual(snapshot.checksum, sha(SWAPPED));
});

test("the reviewer grades this run's job, verifying artifact identity", async () => {
  const [job] = await db.select().from(schema.reviewJobs)
    .where(eq(schema.reviewJobs.submissionVersionId, fixture.versionId));
  assert.ok(job, "submitting must have enqueued a review job");
  assert.equal(job.status, "PENDING");

  const workerId = `${STAMP}-worker`;
  // Targeted by id. The old harness took the head of the global queue, so a
  // concurrent run or leftover data could be graded instead of this fixture.
  const claimed = await claimReviewJob(workerId, new Date(), db, job.id);
  assert.ok(claimed, "the targeted job must be claimable");
  assert.equal(claimed.jobId, job.id);
  assert.ok(claimed.input.sources?.length, "the reviewer must receive extracted evidence sources");
  const fileSource = claimed.input.sources.find((source) => source.id.startsWith("item:"));
  assert.ok(fileSource, "the uploaded file must appear as an evidence source");
  // The snapshot bytes are what was hashed — not the replaced draft.
  assert.equal(fileSource.sha256, sha(SUBMITTED));

  const stub = new StubReviewProvider({ confidence: 0.9 });
  const output = await stub.review({ profile: "review", model: stub.name, input: claimed.input });
  const completed = await completeReviewJob({
    jobId: job.id, workerId, output, model: "integration-stub-v1",
    judgeProvider: new StubReviewProvider({ confidence: 0.88 }), db,
  });
  assert.equal(completed.status, "COMPLETED_HIDDEN");
  assert.ok(completed.finalScore > 0 && completed.finalScore <= 100);

  const [review] = await db.select().from(schema.reviews).where(eq(schema.reviews.submissionVersionId, fixture.versionId));
  // Provenance: the model that graded is recorded, not the literal
  // "external-worker" placeholder the n8n path used to store.
  assert.equal(review.reviewModel, "integration-stub-v1");
  fixture.expectedScore = Number(review.finalScore);
});

test("results stay sealed until the week is finalized, then points land exactly once", async () => {
  const beforeFinalize = await db.select().from(schema.weeklyRankings).where(eq(schema.weeklyRankings.weekId, fixture.weekId));
  assert.equal(beforeFinalize.length, 0, "no ranking may exist before finalization");

  await closeWeekForFinalization({ weekId: fixture.weekId, actorSubject: `${STAMP}-admin`, force: true });
  const finalized = await finalizeWeek({ weekId: fixture.weekId, actorSubject: `${STAMP}-admin` });
  assert.equal(finalized.ranked, 1);
  assert.equal(finalized.pointsAwarded, 300, "a sole finalist ranks first and first place is worth 300 points");

  const [ranking] = await db.select().from(schema.weeklyRankings).where(eq(schema.weeklyRankings.weekId, fixture.weekId));
  assert.equal(ranking.rank, 1);
  assert.equal(ranking.pointsAwarded, 300);
  assert.equal(ranking.submissionVersionId, fixture.versionId);
  assert.equal(Number(ranking.finalScore), fixture.expectedScore);

  const [account] = await db.select().from(schema.pointAccounts).where(eq(schema.pointAccounts.userId, fixture.userId));
  assert.equal(account.balance, 300);
  assert.equal(account.lifetimeEarned, 300);

  // Idempotent re-finalize: the ledger is keyed, so nothing doubles.
  const again = await finalizeWeek({ weekId: fixture.weekId, actorSubject: `${STAMP}-admin` });
  assert.equal(again.ranked, 1);
  const ledger = await db.select().from(schema.pointLedger).where(eq(schema.pointLedger.userId, fixture.userId));
  assert.equal(ledger.length, 1, "re-finalizing must not award a second time");
  const [accountAfter] = await db.select().from(schema.pointAccounts).where(eq(schema.pointAccounts.userId, fixture.userId));
  assert.equal(accountAfter.balance, 300);
});

test("skill evidence is written from the finalized review only", async () => {
  const evidence = await db.select().from(schema.skillEvidence).where(eq(schema.skillEvidence.userId, fixture.userId));
  assert.equal(evidence.length, 1, "one row per project skill");
  assert.equal(evidence[0].skillId, fixture.skillId);
  assert.equal(evidence[0].weekId, fixture.weekId);
});

test("the draft object is reclaimable while the snapshot is not", async () => {
  // Deleting the draft item releases the draft object; the version keeps its
  // own frozen copy, so the review record survives the cleanup.
  const [draftItem] = await db.select().from(schema.submissionDraftItems)
    .where(eq(schema.submissionDraftItems.storageKey, fixture.draftKey));
  assert.ok(draftItem);
  const stillReferenced = await db.select({ id: schema.submissionVersionItems.id })
    .from(schema.submissionVersionItems)
    .where(eq(schema.submissionVersionItems.storageKey, fixture.draftKey));
  assert.equal(stillReferenced.length, 0, "no version may reference the draft key any more");
  await assert.doesNotReject(() => headPrivateObject(fixture.snapshotKey));
});

test("a presign for a snapshot key is refused outright", async () => {
  // Belt and braces on immutability: the presign endpoint only ever issues
  // upload URLs for freshly minted staging keys, never for a frozen artifact.
  await assert.rejects(
    () => createPresignedUpload({ storageKey: fixture.snapshotKey, mimeType: "text/csv" }),
    /staging keys/i,
  );
});
