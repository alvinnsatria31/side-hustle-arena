import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { reviewArtifacts, submissionVersions, submissionVersionItems } from '@/server/db/schema';
import { downloadObjectBytes } from '@/server/storage';
import { assertArtifactIdentity } from '@/server/submissions/version-core';
import { EXECUTION_CONTRACT, type ExecutionBudget } from '@/server/ops/execution-budget';
import { extractDocumentText } from './extract';
import { fetchPublicArtifact } from './fetch-artifact';
import type { ReviewSource } from './reviewer-input';

type Db = ReturnType<typeof getDb>;
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

/**
 * How long submit may spend freezing link content before it gives up.
 *
 * Sized against the submission request, not the review invocation: this runs
 * while a participant waits, often in the last minutes before a deadline. Five
 * links at up to 20s each would be worse than the problem it fixes.
 */
const FREEZE_BUDGET_MS = 20_000;

/**
 * The one spelling of a version item's source id.
 *
 * The submit-time freeze and the claim-time extractor must produce the same id
 * or the freeze does nothing: `ensureReviewSources` skips a source it already
 * has, and it looks it up by exactly this string.
 */
export const sourceIdFor = (versionItemId: string) => `item:${versionItemId}`;

/** Injection seam: the freeze is exercised offline without a network. */
export interface FreezeDeps {
  fetch: typeof fetchPublicArtifact;
  extract: typeof extractDocumentText;
  now: () => number;
}

const LIVE_FREEZE_DEPS: FreezeDeps = { fetch: fetchPublicArtifact, extract: extractDocumentText, now: Date.now };

/**
 * Snapshot the LINK items of a just-submitted version, at submit time.
 *
 * A file is frozen the moment it is submitted: the bytes are copied to a
 * write-once snapshot key and checksummed. A link was not. Its content was
 * fetched later, when a worker claimed the job — possibly hours after the
 * deadline — so a participant could submit a Google Doc on time and keep
 * editing it afterwards, and the score would be given to whatever the document
 * said when the worker happened to read it. The deadline locked the button and
 * nothing else.
 *
 * This closes that window by writing the same `review_artifacts` row
 * `ensureReviewSources` would have written, dated at submit. That function skips
 * any source it already has, so the frozen text is what the reviewer sees.
 *
 * Deliberately best-effort. A link that cannot be fetched or extracted here is
 * left for the claim path exactly as before: failing the submit would spend the
 * participant's deadline on our own extractor, and the accessibility check has
 * already established the link opens. What is lost in that case is the freeze,
 * not the submission — and the reason is logged rather than swallowed.
 */
export async function freezeLinkArtifacts(
  db: Db,
  versionId: string,
  items: Array<typeof submissionVersionItems.$inferSelect>,
  deps: FreezeDeps = LIVE_FREEZE_DEPS,
): Promise<{ frozen: number; deferred: number }> {
  const links = items.filter((item) => item.itemType === 'LINK' && item.externalUrl);
  if (!links.length) return { frozen: 0, deferred: 0 };
  const pending: Array<{ submissionVersionId: string; sourceId: string; kind: string; sha256: string; extractedText: string }> = [];
  let deferred = 0;
  // A participant is watching a spinner, seconds before a deadline. The whole
  // freeze is bounded so a slow host defers rather than holding the submit open.
  const deadline = deps.now() + FREEZE_BUDGET_MS;
  for (const item of links) {
    const remaining = deadline - deps.now();
    if (remaining < 1_000) {
      deferred += 1;
      console.warn(`version ${versionId}: link item ${item.id} not frozen at submit — the freeze budget ran out; the claim path will fetch it instead.`);
      continue;
    }
    try {
      const response = await deps.fetch(item.externalUrl!, { timeoutMs: remaining });
      const text = await deps.extract(response.bytes, item.originalFilename ?? '', response.mime, { timeoutMs: Math.max(1_000, deadline - deps.now()) });
      if (text.length < 12) throw new Error('Extracted text is too short to be evidence.');
      pending.push({
        submissionVersionId: versionId,
        sourceId: sourceIdFor(item.id),
        kind: response.mime.startsWith('image/') ? 'IMAGE_OCR' : 'LINK',
        sha256: digest(response.bytes),
        extractedText: text,
      });
    } catch (error) {
      deferred += 1;
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.warn(`version ${versionId}: link item ${item.id} could not be frozen at submit (${reason}); the claim path will fetch it instead.`);
    }
  }
  if (pending.length) {
    await db.insert(reviewArtifacts).values(pending)
      .onConflictDoNothing({ target: [reviewArtifacts.submissionVersionId, reviewArtifacts.sourceId] });
  }
  return { frozen: pending.length, deferred };
}

/**
 * Snapshot every evidence source for a version, under one shared deadline.
 *
 * Extraction is the part of a review that used to run outside every budget:
 * it happens during the claim, and each document or image had only its own
 * per-call timeout. Five items could therefore outlast the invocation that
 * claimed them, which leaves the job leased to a worker that no longer exists.
 * The budget passed in here bounds the whole loop, and running out is reported
 * as a normal extraction failure — the job retries, no user attempt is spent.
 *
 * Anything already snapshotted is reused as-is, which is what makes the
 * submit-time link freeze above effective: a link frozen at submit is never
 * re-fetched here, so the score is given to what was sent, not to whatever the
 * document says by the time a worker gets to it.
 */
export async function ensureReviewSources(db: Db, version: typeof submissionVersions.$inferSelect, items: Array<typeof submissionVersionItems.$inferSelect>, options: { budget?: ExecutionBudget } = {}): Promise<ReviewSource[]> {
  const existing = await db.select().from(reviewArtifacts).where(eq(reviewArtifacts.submissionVersionId, version.id));
  const sources = new Map(existing.map((row) => [row.sourceId, { id: row.sourceId, kind: row.kind, text: row.extractedText, sha256: row.sha256 }]));
  const pending: ReviewSource[] = [];
  for (const [id, text] of [['explanation', version.explanation], ['notes', version.notes]] as const) {
    if (text?.trim() && !sources.has(id)) pending.push({ id, kind: 'TEXT', text, sha256: digest(text) });
  }
  for (const item of items) {
    const id = sourceIdFor(item.id);
    if (sources.has(id)) continue;
    // Checked per item, not once up front: the point is to stop before the
    // item that would overrun, and to leave what is already snapshotted intact.
    options.budget?.assertRoomFor(1_000, `extracting ${item.itemType.toLowerCase()} artifact`);
    const stageSignal = options.budget?.signal(EXECUTION_CONTRACT.extractionBudgetMs);
    const stageTimeoutMs = options.budget?.remainingMs();
    let bytes: Buffer;
    let mime = item.mimeType ?? '';
    if (item.itemType === 'FILE' && item.storageKey) {
      // Identity, not size. Equal length proves nothing against a replayed
      // presigned PUT — only the checksum recorded when the version was frozen
      // says these are the bytes the participant actually submitted.
      const object = await downloadObjectBytes(item.storageKey, {
        expectedSizeBytes: item.fileSizeBytes ?? undefined,
        expectedChecksum: item.checksum,
      });
      assertArtifactIdentity(item, object);
      bytes = object.bytes;
    } else if (item.itemType === 'LINK' && item.externalUrl) {
      const response = await fetchPublicArtifact(item.externalUrl, { signal: stageSignal, timeoutMs: stageTimeoutMs });
      bytes = response.bytes; mime = response.mime;
    } else { continue; }
    const text = await extractDocumentText(bytes, item.originalFilename ?? '', mime, { signal: stageSignal, timeoutMs: stageTimeoutMs });
    if (text.length < 12) throw new Error('Artifact requires manual inspection.');
    pending.push({ id, kind: mime.startsWith('image/') ? 'IMAGE_OCR' : item.itemType, text, sha256: digest(bytes) });
  }
  const all = [...sources.values(), ...pending];
  if (!all.length || all.reduce((sum, source) => sum + source.text.length, 0) > 150_000) {
    throw new Error('Evidence is empty or exceeds review limits; manual inspection is required.');
  }
  if (pending.length) {
    await db.insert(reviewArtifacts).values(pending.map((source) => ({ submissionVersionId: version.id, sourceId: source.id, kind: source.kind, sha256: source.sha256, extractedText: source.text })))
      .onConflictDoNothing({ target: [reviewArtifacts.submissionVersionId, reviewArtifacts.sourceId] });
  }
  // Another claimant may have won a source snapshot; always return persisted content.
  const stored = await db.select().from(reviewArtifacts).where(eq(reviewArtifacts.submissionVersionId, version.id));
  return stored.map((row) => ({ id: row.sourceId, kind: row.kind, text: row.extractedText, sha256: row.sha256 }));
}
