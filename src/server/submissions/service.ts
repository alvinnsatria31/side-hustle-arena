import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { ArenaDomainError } from "@/server/arena/errors";
import { getDb } from "@/server/db/client";
import {
  enrollments,
  projects,
  projectSubmissionRequirements,
  submissionDraftItems,
  submissionVersionItems,
  submissionVersions,
  submissions,
  uploadIntents,
  weekRules,
  weeks,
} from "@/server/db/schema";
import { createImmutableSnapshot, createPresignedDownload, createPresignedUpload, createSnapshotObjectKey, createSubmissionObjectKey, deletePrivateObject, downloadObjectBytes, assertContentSignature, getStorageEnvironment, headPrivateObject } from "@/server/storage";
import { assertArenaFeatureOpen } from "@/server/ops/feature-flags";
import { notifyBestEffort } from "@/server/notifications/service";
import { enqueueReviewJob } from "@/server/reviews/queue-service";
import { assertCapturedLinkSet, captureLinkArtifacts, persistLinkArtifacts } from "@/server/reviews/artifacts";
import { deadlineSentence } from "@/lib/deadline";
import { overfilledRequirements, unmetRequirements } from "@/lib/submission-requirements";
import { checkExternalUrlAccess } from "./url-access";
import { planVersionSnapshots, resolveVersionItemStorage, type FrozenArtifact } from "./version-core";
import { draftLinkSchema, draftSubmissionSchema, supportedFileMimeTypes, uploadPresignSchema } from "./schemas";

const MAX_FILES = 5;
const MAX_LINKS = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const UPLOAD_INTENT_TTL_MS = 10 * 60 * 1_000;

type Db = ReturnType<typeof getDb>;
type Submission = typeof submissions.$inferSelect;
type DraftItem = typeof submissionDraftItems.$inferSelect;

async function ownedContext(db: Db, userId: string, enrollmentId: string) {
  const row = (await db.select({ enrollment: enrollments, week: weeks, rules: weekRules }).from(enrollments)
    .innerJoin(weeks, eq(enrollments.weekId, weeks.id))
    .innerJoin(weekRules, eq(weekRules.weekId, weeks.id))
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, userId))))[0];
  if (!row) throw new ArenaDomainError("ENROLLMENT_NOT_FOUND", "Enrollment not found.");
  return row;
}

function assertBeforeDeadline(deadline: Date, now: Date) {
  if (now >= deadline) throw new ArenaDomainError("SUBMISSION_DEADLINE_PASSED", "The submission deadline has passed.");
}

/**
 * A week takes submission changes only while it is OPEN and before its deadline.
 *
 * The deadline alone was not enough. An admin force-close or early finalize
 * changes the week's status without moving `submissionDeadlineAt`, so a
 * participant with the form still open could keep editing — and submit a new
 * attempt into a week whose results were already published. The deadline keeps
 * its own, more specific code: the form words the two cases differently.
 */
function assertWeekOpenForSubmission(week: typeof weeks.$inferSelect, now: Date) {
  if (week.status !== "OPEN") throw new ArenaDomainError("WEEK_CLOSED", "This Arena week is closed for submissions.");
  assertBeforeDeadline(week.submissionDeadlineAt, now);
}

/**
 * The same gate, read again inside the writing transaction under FOR SHARE.
 *
 * Closing and finalizing both write the week row, which a share lock blocks
 * until commit. So a close either lands before this read, and the write is
 * refused, or waits for the write to commit, and finalization then sees the
 * new version with its queued review. The earlier check on the context row is
 * only the cheap refusal; this one is the one a race cannot slip past.
 */
async function lockWeekOpenForSubmission(tx: Db, weekId: string, now: Date) {
  const [week] = await tx.select().from(weeks).where(eq(weeks.id, weekId)).for("share");
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Arena week not found.");
  assertWeekOpenForSubmission(week, now);
}

async function ensureSubmission(db: Db, context: Awaited<ReturnType<typeof ownedContext>>) {
  await db.insert(submissions).values({
    enrollmentId: context.enrollment.id,
    userId: context.enrollment.userId,
    weekId: context.enrollment.weekId,
    projectId: context.enrollment.projectId,
  }).onConflictDoNothing();
  const submission = (await db.select().from(submissions).where(eq(submissions.enrollmentId, context.enrollment.id)))[0];
  if (!submission) throw new ArenaDomainError("SUBMISSION_NOT_FOUND", "Submission not found.");
  return submission;
}

async function requirementForProject(db: Db, projectId: string, requirementId: string, type: "FILE" | "LINK" | "TEXT") {
  const requirement = (await db.select().from(projectSubmissionRequirements)
    .where(and(eq(projectSubmissionRequirements.id, requirementId), eq(projectSubmissionRequirements.projectId, projectId))))[0];
  if (!requirement || requirement.type !== type) throw new ArenaDomainError("VALIDATION_ERROR", "Submission requirement is not valid for this item.");
  return requirement;
}

function serializeDraftItem(item: DraftItem) {
  const { storageKey: _storageKey, ...clientSafe } = item;
  return clientSafe;
}

function serializeVersionItem(item: typeof submissionVersionItems.$inferSelect) {
  const { storageKey: _storageKey, checksum: _checksum, ...clientSafe } = item;
  return clientSafe;
}

/**
 * What was actually submitted, as distinct from what the draft says now.
 *
 * The two diverge in the case that matters most. A submit whose link a reviewer
 * cannot open produces a version with `accessStatus: FAILED` — no attempt spent,
 * nothing queued — while the submission row still reads SUBMITTED. Reading only
 * the row, the UI told the participant their project was in review and left them
 * waiting for a result that was never coming. The draft can also be edited after
 * a successful submit, so a recap built from draft items shows something the
 * reviewer never saw.
 */
async function latestVersionSummary(db: Db, submission: Submission) {
  if (!submission.latestVersionId) return null;
  const version = (await db.select().from(submissionVersions).where(eq(submissionVersions.id, submission.latestVersionId)))[0];
  if (!version) return null;
  const items = await db.select().from(submissionVersionItems).where(eq(submissionVersionItems.submissionVersionId, version.id));
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    submittedAt: version.submittedAt,
    accessStatus: version.accessStatus,
    reviewStatus: version.reviewStatus,
    reviewAttemptNumber: version.reviewAttemptNumber,
    isFinal: version.isFinal,
    explanation: version.explanation,
    notes: version.notes,
    items: items.map(serializeVersionItem),
  };
}

function serializeSubmission(submission: Submission, items: DraftItem[], latestVersion: Awaited<ReturnType<typeof latestVersionSummary>> = null) {
  return {
    id: submission.id,
    enrollmentId: submission.enrollmentId,
    status: submission.status,
    explanation: submission.draftExplanation,
    notes: submission.draftNotes,
    reviewAttemptsUsed: submission.reviewAttemptsUsed,
    latestVersionId: submission.latestVersionId,
    latestVersion,
    items: items.map(serializeDraftItem),
  };
}

async function getDraftItems(db: Db, submissionId: string) {
  return db.select().from(submissionDraftItems).where(eq(submissionDraftItems.submissionId, submissionId));
}

function allowedMime(requirement: typeof projectSubmissionRequirements.$inferSelect, mimeType: string) {
  return supportedFileMimeTypes.includes(mimeType as (typeof supportedFileMimeTypes)[number])
    && (!requirement.allowedMimeTypes || requirement.allowedMimeTypes.includes(mimeType));
}

function limitFor(requirement: typeof projectSubmissionRequirements.$inferSelect, type: "FILE" | "LINK") {
  return Math.min(type === "FILE" ? MAX_FILES : MAX_LINKS, requirement.maxItems);
}

function mapStorageError(error: unknown): never {
  if (error instanceof ArenaDomainError) throw error;
  throw new ArenaDomainError("STORAGE_NOT_CONFIGURED", "Private development storage is not configured.");
}

export async function getArenaSubmission({ userId, enrollmentId }: { userId: string; enrollmentId: string }) {
  const db = getDb();
  const context = await ownedContext(db, userId, enrollmentId);
  const submission = await ensureSubmission(db, context);
  return serializeSubmission(submission, await getDraftItems(db, submission.id), await latestVersionSummary(db, submission));
}

export async function patchArenaSubmissionDraft({ userId, enrollmentId, input, now = new Date() }: { userId: string; enrollmentId: string; input: unknown; now?: Date }) {
  const parsed = draftSubmissionSchema.safeParse(input);
  if (!parsed.success) throw new ArenaDomainError("VALIDATION_ERROR", "Invalid submission draft request.");
  await assertArenaFeatureOpen("arena-submissions");
  const db = getDb();
  const context = await ownedContext(db, userId, enrollmentId);
  assertWeekOpenForSubmission(context.week, now);
  const submission = await ensureSubmission(db, context);
  const updated = (await db.update(submissions).set({
    ...(Object.hasOwn(parsed.data, "explanation") ? { draftExplanation: parsed.data.explanation ?? null } : {}),
    ...(Object.hasOwn(parsed.data, "notes") ? { draftNotes: parsed.data.notes ?? null } : {}),
    updatedAt: now,
  }).where(eq(submissions.id, submission.id)).returning())[0];
  return serializeSubmission(updated, await getDraftItems(db, updated.id), await latestVersionSummary(db, updated));
}

export async function addArenaSubmissionLink({ userId, enrollmentId, input, now = new Date() }: { userId: string; enrollmentId: string; input: unknown; now?: Date }) {
  const parsed = draftLinkSchema.safeParse(input);
  if (!parsed.success) throw new ArenaDomainError("VALIDATION_ERROR", "Invalid submission link request.");
  await assertArenaFeatureOpen("arena-submissions");
  const db = getDb();
  const context = await ownedContext(db, userId, enrollmentId);
  assertWeekOpenForSubmission(context.week, now);
  const submission = await ensureSubmission(db, context);
  const requirement = await requirementForProject(db, context.enrollment.projectId, parsed.data.requirementId, "LINK");
  const items = await getDraftItems(db, submission.id);
  if (items.filter((item) => item.itemType === "LINK").length >= MAX_LINKS || items.filter((item) => item.requirementId === requirement.id).length >= limitFor(requirement, "LINK")) {
    throw new ArenaDomainError("LINK_LIMIT_EXCEEDED", "The link limit for this submission requirement has been reached.");
  }
  return serializeDraftItem((await db.insert(submissionDraftItems).values({
    submissionId: submission.id, requirementId: requirement.id, itemType: "LINK", label: parsed.data.label ?? null, externalUrl: parsed.data.url,
  }).returning())[0]);
}

export async function createArenaUploadIntent({ userId, enrollmentId, input, now = new Date() }: { userId: string; enrollmentId: string; input: unknown; now?: Date }) {
  const parsed = uploadPresignSchema.safeParse(input);
  if (!parsed.success) throw new ArenaDomainError("VALIDATION_ERROR", "Invalid upload request.");
  await assertArenaFeatureOpen("arena-submissions");
  const db = getDb();
  const context = await ownedContext(db, userId, enrollmentId);
  assertWeekOpenForSubmission(context.week, now);
  const submission = await ensureSubmission(db, context);
  const requirement = await requirementForProject(db, context.enrollment.projectId, parsed.data.requirementId, "FILE");
  if (!allowedMime(requirement, parsed.data.mimeType)) throw new ArenaDomainError("FILE_TYPE_NOT_ALLOWED", "This file type is not allowed for the requirement.");
  if (parsed.data.sizeBytes > MAX_FILE_BYTES) throw new ArenaDomainError("FILE_TOO_LARGE", "This file exceeds the maximum upload size.");
  const existingFiles = await getDraftItems(db, submission.id);
  if (existingFiles.filter((item) => item.itemType === "FILE").length >= MAX_FILES || existingFiles.filter((item) => item.requirementId === requirement.id).length >= limitFor(requirement, "FILE")) {
    throw new ArenaDomainError("FILE_LIMIT_EXCEEDED", "The file limit for this submission requirement has been reached.");
  }

  const storageKey = createSubmissionObjectKey(getStorageEnvironment());
  const expiresAt = new Date(now.getTime() + UPLOAD_INTENT_TTL_MS);
  const intent = (await db.insert(uploadIntents).values({
    userId, enrollmentId, submissionId: submission.id, requirementId: requirement.id, storageKey,
    expectedMimeType: parsed.data.mimeType, expectedSizeBytes: parsed.data.sizeBytes, originalFilename: parsed.data.filename, expiresAt,
  }).returning())[0];
  try {
    const upload = await createPresignedUpload({ storageKey, mimeType: parsed.data.mimeType });
    return { intentId: intent.id, uploadUrl: upload, requiredHeaders: { "content-type": parsed.data.mimeType }, expiresAt };
  } catch (error) {
    await db.delete(uploadIntents).where(eq(uploadIntents.id, intent.id));
    return mapStorageError(error);
  }
}

export async function finalizeArenaUpload({ userId, enrollmentId, intentId, now = new Date() }: { userId: string; enrollmentId: string; intentId: string; now?: Date }) {
  await assertArenaFeatureOpen("arena-submissions");
  const db = getDb();
  const context = await ownedContext(db, userId, enrollmentId);
  assertWeekOpenForSubmission(context.week, now);
  const intent = (await db.select().from(uploadIntents).where(and(eq(uploadIntents.id, intentId), eq(uploadIntents.userId, userId), eq(uploadIntents.enrollmentId, enrollmentId), isNull(uploadIntents.consumedAt))))[0];
  if (!intent) throw new ArenaDomainError("UPLOAD_INTENT_NOT_FOUND", "Upload intent not found.");
  if (intent.expiresAt <= now) throw new ArenaDomainError("UPLOAD_INTENT_EXPIRED", "Upload intent has expired.");

  let object: Awaited<ReturnType<typeof headPrivateObject>>;
  try {
    object = await headPrivateObject(intent.storageKey);
  } catch (error) {
    return mapStorageError(error);
  }
  if (object.ContentLength !== intent.expectedSizeBytes || object.ContentType !== intent.expectedMimeType) {
    await deletePrivateObject(intent.storageKey).catch(() => undefined);
    throw new ArenaDomainError("UPLOAD_VALIDATION_FAILED", "Uploaded object metadata did not match the upload intent.");
  }

  // Magic-bytes admission check: the declared MIME/extension is not trusted on
  // its own — a renamed executable must fail here, before the draft references
  // it and long before a reviewer opens it. Failures delete the object so a
  // spoofed upload can never be finalized on retry.
  let checksum: string;
  try {
    const content = await downloadObjectBytes(intent.storageKey, { expectedSizeBytes: intent.expectedSizeBytes });
    assertContentSignature(content.bytes, intent.expectedMimeType);
    // Recorded now, over the bytes we actually read. Submit re-verifies against
    // this before freezing, so a replayed PUT between finalize and submit is
    // caught instead of silently becoming the reviewed artifact.
    checksum = content.checksum;
  } catch (error) {
    await deletePrivateObject(intent.storageKey).catch(() => undefined);
    if (error instanceof ArenaDomainError) throw error;
    return mapStorageError(error);
  }

  return db.transaction(async (tx) => {
    await lockWeekOpenForSubmission(tx, context.week.id, now);
    const freshIntent = (await tx.update(uploadIntents).set({ consumedAt: now })
      .where(and(eq(uploadIntents.id, intent.id), isNull(uploadIntents.consumedAt), gt(uploadIntents.expiresAt, now))).returning())[0];
    if (!freshIntent) throw new ArenaDomainError("UPLOAD_INTENT_EXPIRED", "Upload intent is no longer valid.");
    const submission = await ensureSubmission(tx, context);
    const requirement = await requirementForProject(tx, context.enrollment.projectId, freshIntent.requirementId!, "FILE");
    const items = await getDraftItems(tx, submission.id);
    if (items.filter((item) => item.itemType === "FILE").length >= MAX_FILES || items.filter((item) => item.requirementId === requirement.id).length >= limitFor(requirement, "FILE")) {
      throw new ArenaDomainError("FILE_LIMIT_EXCEEDED", "The file limit for this submission requirement has been reached.");
    }
    return serializeDraftItem((await tx.insert(submissionDraftItems).values({
      submissionId: submission.id, requirementId: freshIntent.requirementId, itemType: "FILE", storageKey: freshIntent.storageKey,
      originalFilename: freshIntent.originalFilename, mimeType: freshIntent.expectedMimeType, fileSizeBytes: freshIntent.expectedSizeBytes,
      checksum,
    }).returning())[0]);
  });
}

export async function deleteArenaSubmissionItem({ userId, enrollmentId, itemId, now = new Date() }: { userId: string; enrollmentId: string; itemId: string; now?: Date }) {
  await assertArenaFeatureOpen("arena-submissions");
  const db = getDb();
  const context = await ownedContext(db, userId, enrollmentId);
  assertWeekOpenForSubmission(context.week, now);
  const submission = await ensureSubmission(db, context);
  const item = (await db.delete(submissionDraftItems).where(and(eq(submissionDraftItems.id, itemId), eq(submissionDraftItems.submissionId, submission.id))).returning())[0];
  if (!item) throw new ArenaDomainError("SUBMISSION_ITEM_NOT_FOUND", "Submission item not found.");
  if (item.storageKey) {
    const stillReferenced = (await db.select({ id: submissionVersionItems.id }).from(submissionVersionItems)
      .where(eq(submissionVersionItems.storageKey, item.storageKey)).limit(1))[0];
    if (!stillReferenced) await deletePrivateObject(item.storageKey).catch(() => undefined);
  }
}

function validateRequirements(requirements: (typeof projectSubmissionRequirements.$inferSelect)[], items: DraftItem[]) {
  // Same rule the form checks before it submits (src/lib/submission-requirements),
  // so a refusal here can never be for something the participant had no box for.
  const unmet = unmetRequirements(requirements, items);
  const overfilled = overfilledRequirements(requirements, items);
  if (unmet.length || overfilled.length) {
    throw new ArenaDomainError("SUBMISSION_REQUIREMENTS_INCOMPLETE", "Submission requirements are incomplete.");
  }
}

/**
 * Freeze every draft file into a write-once snapshot object.
 *
 * The draft key stays presignable until its upload intent expires, so it is
 * not a safe thing for a submitted version to reference. Each snapshot is
 * written under a fresh `snapshots/` key with `If-None-Match: *` and read back
 * before it is trusted, and the source bytes are re-verified against the
 * checksum recorded at finalize — a replayed PUT in between fails here rather
 * than becoming the reviewed artifact.
 */
async function freezeDraftFiles(items: DraftItem[], environment: "development" | "production"): Promise<Map<string, FrozenArtifact>> {
  const frozen = new Map<string, FrozenArtifact>();
  for (const item of planVersionSnapshots(items)) {
    frozen.set(item.id, await createImmutableSnapshot({
      sourceKey: item.storageKey!,
      snapshotKey: createSnapshotObjectKey(environment),
      mimeType: item.mimeType ?? "application/octet-stream",
      sizeBytes: item.fileSizeBytes ?? 0,
      checksum: item.checksum,
    }));
  }
  return frozen;
}

async function createVersion(tx: Db, submission: Submission, items: DraftItem[], access: "ACCESSIBLE" | "FAILED", reviewAttemptNumber: number | null, now: Date, snapshots: ReadonlyMap<string, FrozenArtifact> = new Map()) {
  const newest = (await tx.select({ versionNumber: submissionVersions.versionNumber }).from(submissionVersions)
    .where(eq(submissionVersions.submissionId, submission.id)).orderBy(desc(submissionVersions.versionNumber)).limit(1))[0];
  const version = (await tx.insert(submissionVersions).values({
    submissionId: submission.id, versionNumber: (newest?.versionNumber ?? 0) + 1, explanation: submission.draftExplanation, notes: submission.draftNotes,
    submittedAt: now, accessStatus: access, reviewAttemptNumber, reviewStatus: "NOT_QUEUED",
  }).returning())[0];
  if (items.length) await tx.insert(submissionVersionItems).values(items.map((item) => {
    // A FAILED version is a record of a rejected submit, never a review input,
    // so it keeps only metadata: no snapshot exists and no draft key is copied.
    const storage = access === "ACCESSIBLE"
      ? resolveVersionItemStorage(item, snapshots)
      : { storageKey: null, checksum: null, fileSizeBytes: item.fileSizeBytes };
    return {
      submissionVersionId: version.id, requirementId: item.requirementId, itemType: item.itemType, label: item.label,
      storageKey: storage.storageKey, externalUrl: item.externalUrl, originalFilename: item.originalFilename,
      mimeType: item.mimeType, fileSizeBytes: storage.fileSizeBytes, checksum: storage.checksum, textContent: item.textContent,
    };
  }));
  await tx.update(submissions).set({ status: "SUBMITTED", latestVersionId: version.id, updatedAt: now }).where(eq(submissions.id, submission.id));
  return version;
}

/**
 * Can a reviewer actually open every uploaded file?
 *
 * A false here costs the participant a version marked FAILED, so the reason has
 * to be recoverable afterwards. It previously was not: one `try` wrapped the
 * whole loop and swallowed every error identically, so "this link is dead" and
 * "our own network hiccuped for 3 seconds" produced the same silent FAILED with
 * nothing written anywhere. That is a genuinely bad failure to debug — the
 * participant sees a rejected submission and the logs say nothing at all.
 *
 * Links use the stricter capture path before the transaction. This check is
 * retained for private file objects and still fails closed per item.
 */
async function draftFilesAccessible(items: DraftItem[], submissionId: string) {
  for (const item of items) {
    try {
      if (item.itemType === "FILE" && item.storageKey) await headPrivateObject(item.storageKey);
    } catch (error) {
      // Reached when the CHECK broke, not when the item was judged unreachable —
      // a DNS failure, a timeout, storage refusing a HEAD. Same outcome, very
      // different cause, and only this line distinguishes them later.
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.warn(`submission ${submissionId}: accessibility check for ${item.itemType} item ${item.id} could not complete — ${reason}`);
      return false;
    }
  }
  return true;
}

export async function submitArenaSubmission({ userId, enrollmentId, now = new Date() }: { userId: string; enrollmentId: string; now?: Date }) {
  await assertArenaFeatureOpen("arena-submissions");
  const db = getDb();
  const context = await ownedContext(db, userId, enrollmentId);
  assertWeekOpenForSubmission(context.week, now);
  const preflightSubmission = await ensureSubmission(db, context);
  const preflightItems = await getDraftItems(db, preflightSubmission.id);
  const preflightRequirements = await db.select().from(projectSubmissionRequirements).where(eq(projectSubmissionRequirements.projectId, context.enrollment.projectId));
  validateRequirements(preflightRequirements, preflightItems);
  if (preflightItems.filter((item) => item.itemType === "FILE").length > MAX_FILES) throw new ArenaDomainError("FILE_LIMIT_EXCEEDED", "The file limit for this submission has been reached.");
  if (preflightItems.filter((item) => item.itemType === "LINK").length > MAX_LINKS) throw new ArenaDomainError("LINK_LIMIT_EXCEEDED", "The link limit for this submission has been reached.");
  // External reads happen before the write transaction. Every captured source
  // is matched again under the submission lock before it is persisted.
  const capturedLinks = await captureLinkArtifacts(preflightItems);
  const result = await db.transaction(async (tx) => {
    await lockWeekOpenForSubmission(tx, context.week.id, now);
    const submission = await ensureSubmission(tx, context);
    // Serialize concurrent submits for one submission: without this lock, two
    // transactions can read the same MAX(version_number) and the loser aborts
    // on the unique backstop with a raw 500. Row lock, never a new constraint.
    await tx.select({ id: submissions.id }).from(submissions).where(eq(submissions.id, submission.id)).for("update");
    await tx.update(submissions).set({ updatedAt: now }).where(eq(submissions.id, submission.id));
    const items = await getDraftItems(tx, submission.id);
    const requirements = await tx.select().from(projectSubmissionRequirements).where(eq(projectSubmissionRequirements.projectId, context.enrollment.projectId));
    validateRequirements(requirements, items);
    // Global caps are re-checked here (not only at add-time): requirement
    // maxItems may have been raised after items were added.
    if (items.filter((item) => item.itemType === "FILE").length > MAX_FILES) {
      throw new ArenaDomainError("FILE_LIMIT_EXCEEDED", "The file limit for this submission has been reached.");
    }
    if (items.filter((item) => item.itemType === "LINK").length > MAX_LINKS) {
      throw new ArenaDomainError("LINK_LIMIT_EXCEEDED", "The link limit for this submission has been reached.");
    }
    assertCapturedLinkSet(items, capturedLinks);
    if (!await draftFilesAccessible(items, submission.id)) return { version: await createVersion(tx, submission, items, "FAILED", null, now), allocatedReviewAttempt: false };

    // Freeze before the attempt is allocated: a storage failure here must not
    // burn one of the participant's three reviews (PRD §42).
    const frozen = await freezeDraftFiles(items, getStorageEnvironment());

    const allocation = (await tx.update(submissions).set({ reviewAttemptsUsed: sql`${submissions.reviewAttemptsUsed} + 1`, updatedAt: now })
      .where(and(eq(submissions.id, submission.id), sql`${submissions.reviewAttemptsUsed} < ${context.rules.maxReviewAttempts}`))
      .returning({ reviewAttemptsUsed: submissions.reviewAttemptsUsed }))[0];
    if (!allocation) throw new ArenaDomainError("REVIEW_ATTEMPT_LIMIT_REACHED", "The review attempt limit has been reached.");
    const version = await createVersion(tx, submission, items, "ACCESSIBLE", allocation.reviewAttemptsUsed, now, frozen);
    await persistLinkArtifacts(tx, version.id, capturedLinks);
    // Review queue is automation state: the user attempt is already allocated
    // above; the job row only schedules the reviewer worker (PRD §42).
    await enqueueReviewJob(tx, version.id, now);
    return { version, allocatedReviewAttempt: true };
  });

  // Best-effort inbox notice: must never break the submit itself (PRD §36).
  // Canonical slug deep link — the detail route resolves slugs and UUIDs, but
  // the slug is the stable, shareable form (matches EnrollmentCard links).
  const projectSlug = (
    await db.select({ slug: projects.slug }).from(projects).where(eq(projects.id, context.enrollment.projectId))
  )[0]?.slug;
  const actionUrl = `/app/arena/submission/${projectSlug ?? context.enrollment.projectId}`;
  if (result.version.accessStatus === "FAILED") {
    await notifyBestEffort({
      type: "SUBMISSION_ACCESS_FAILED",
      userId,
      weekId: context.week.id,
      title: "Submission belum bisa dinilai",
      // The real deadline of THIS week. Ad-hoc weeks do not end on a Friday, and
      // an email that names the wrong day is worse than one that names no day.
      body: `Ada link/file yang tidak bisa dibuka reviewer. Benerin sebelum deadline ${deadlineSentence(context.week.submissionDeadlineAt)} — jatah ${context.rules.maxReviewAttempts}x review kamu aman.`,
      actionUrl,
    });
  } else {
    await notifyBestEffort({
      type: "SUBMISSION_RECEIVED",
      userId,
      weekId: context.week.id,
      title: `Submission #${result.version.reviewAttemptNumber} diterima`,
      body: `Karyamu masuk antrean review. Hasilnya disegel sampai finalisasi ${deadlineSentence(context.week.submissionDeadlineAt)} — pantau dari workspace.`,
      actionUrl,
    });
  }
  return result;
}

export async function getArenaSubmissionDownload({ userId, enrollmentId, itemId }: { userId: string; enrollmentId: string; itemId: string }) {
  const db = getDb();
  const context = await ownedContext(db, userId, enrollmentId);
  const submission = await ensureSubmission(db, context);
  const draftItem = (await db.select().from(submissionDraftItems).where(and(eq(submissionDraftItems.id, itemId), eq(submissionDraftItems.submissionId, submission.id))))[0];
  // A submitted version's items are the ones the recap shows, and they are not
  // draft rows — a participant asking for "the file I actually sent" was getting
  // a 404 for it. Ownership is enforced the same way: the version has to belong
  // to this enrollment's submission.
  const item = draftItem ?? (await db.select({ item: submissionVersionItems }).from(submissionVersionItems)
    .innerJoin(submissionVersions, eq(submissionVersionItems.submissionVersionId, submissionVersions.id))
    .where(and(eq(submissionVersionItems.id, itemId), eq(submissionVersions.submissionId, submission.id))))[0]?.item;
  if (!item?.storageKey) throw new ArenaDomainError("SUBMISSION_ITEM_NOT_FOUND", "Private file not found.");
  try {
    return { url: await createPresignedDownload(item.storageKey, item.originalFilename), filename: item.originalFilename };
  } catch (error) {
    return mapStorageError(error);
  }
}
