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
 * Snapshot every evidence source for a version, under one shared deadline.
 *
 * Extraction is the part of a review that used to run outside every budget:
 * it happens during the claim, and each document or image had only its own
 * per-call timeout. Five items could therefore outlast the invocation that
 * claimed them, which leaves the job leased to a worker that no longer exists.
 * The budget passed in here bounds the whole loop, and running out is reported
 * as a normal extraction failure — the job retries, no user attempt is spent.
 */
export async function ensureReviewSources(db: Db, version: typeof submissionVersions.$inferSelect, items: Array<typeof submissionVersionItems.$inferSelect>, options: { budget?: ExecutionBudget } = {}): Promise<ReviewSource[]> {
  const existing = await db.select().from(reviewArtifacts).where(eq(reviewArtifacts.submissionVersionId, version.id));
  const sources = new Map(existing.map((row) => [row.sourceId, { id: row.sourceId, kind: row.kind, text: row.extractedText, sha256: row.sha256 }]));
  const pending: ReviewSource[] = [];
  for (const [id, text] of [['explanation', version.explanation], ['notes', version.notes]] as const) {
    if (text?.trim() && !sources.has(id)) pending.push({ id, kind: 'TEXT', text, sha256: digest(text) });
  }
  for (const item of items) {
    const id = `item:${item.id}`;
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
