import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getDb } from '@/server/db/client';
import { reviewArtifacts, submissionVersions, submissionVersionItems } from '@/server/db/schema';
import { getStorageClient, getStorageConfig } from '@/server/storage';
import { extractDocumentText } from './extract';
import { fetchPublicArtifact } from './fetch-artifact';
import type { ReviewSource } from './reviewer-input';

type Db = ReturnType<typeof getDb>;
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

export async function ensureReviewSources(db: Db, version: typeof submissionVersions.$inferSelect, items: Array<typeof submissionVersionItems.$inferSelect>): Promise<ReviewSource[]> {
  const existing = await db.select().from(reviewArtifacts).where(eq(reviewArtifacts.submissionVersionId, version.id));
  const sources = new Map(existing.map((row) => [row.sourceId, { id: row.sourceId, kind: row.kind, text: row.extractedText, sha256: row.sha256 }]));
  const pending: ReviewSource[] = [];
  for (const [id, text] of [['explanation', version.explanation], ['notes', version.notes]] as const) {
    if (text?.trim() && !sources.has(id)) pending.push({ id, kind: 'TEXT', text, sha256: digest(text) });
  }
  for (const item of items) {
    const id = `item:${item.id}`;
    if (sources.has(id)) continue;
    let bytes: Buffer;
    let mime = item.mimeType ?? '';
    if (item.itemType === 'FILE' && item.storageKey) {
      const object = await getStorageClient().send(new GetObjectCommand({ Bucket: getStorageConfig().bucket, Key: item.storageKey }));
      if (!object.Body || !object.ContentLength || object.ContentLength > 20 * 1024 * 1024) throw new Error('Invalid stored artifact.');
      bytes = Buffer.from(await object.Body.transformToByteArray());
      if (bytes.length !== item.fileSizeBytes) throw new Error('Stored artifact size changed.');
    } else if (item.itemType === 'LINK' && item.externalUrl) {
      const response = await fetchPublicArtifact(item.externalUrl);
      bytes = response.bytes; mime = response.mime;
    } else { continue; }
    const text = await extractDocumentText(bytes, item.originalFilename ?? '', mime);
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
