import "server-only";
import { and, asc, eq, isNull, lt, notExists } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { submissionDraftItems, submissionVersionItems, uploadIntents } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { cleanupUnusedObjects, UNUSED_OBJECT_GRACE_MS } from "./cleanup-core";
import { getStorageEnvironment } from "./config";
import { deletePrivateObject } from "./upload";

/** No bucket listing: only ledger-backed, expired, unused objects are candidates. */
export async function cleanupExpiredUploads({ dryRun = true, limit = 25, now = new Date() }: { dryRun?: boolean; limit?: number; now?: Date } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isFinite(now.getTime())) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Cleanup limit must be between 1 and 100.");
  }
  const db = getDb();
  const cutoff = new Date(now.getTime() - UNUSED_OBJECT_GRACE_MS);
  const eligible = and(isNull(uploadIntents.consumedAt), lt(uploadIntents.expiresAt, cutoff),
    notExists(db.select({ id: submissionDraftItems.id }).from(submissionDraftItems).where(eq(submissionDraftItems.storageKey, uploadIntents.storageKey))),
    notExists(db.select({ id: submissionVersionItems.id }).from(submissionVersionItems).where(eq(submissionVersionItems.storageKey, uploadIntents.storageKey))));
  const candidates = await db.select({ id: uploadIntents.id }).from(uploadIntents)
    .where(eligible).orderBy(asc(uploadIntents.expiresAt), asc(uploadIntents.id)).limit(limit);
  const totals = { scanned: 0, eligible: 0, deleted: 0, skipped: 0, failed: 0, dryRun };
  for (const candidate of candidates) {
    const result = await db.transaction(async (tx) => {
      const rows = await tx.select().from(uploadIntents)
        .where(and(eq(uploadIntents.id, candidate.id), eligible)).for("update", { skipLocked: true });
      return cleanupUnusedObjects(rows, { now, dryRun, environment: getStorageEnvironment() }, {
        async isReferenced(key) {
          const draft = await tx.select({ id: submissionDraftItems.id }).from(submissionDraftItems)
            .where(eq(submissionDraftItems.storageKey, key)).limit(1);
          if (draft.length) return true;
          const version = await tx.select({ id: submissionVersionItems.id }).from(submissionVersionItems)
            .where(eq(submissionVersionItems.storageKey, key)).limit(1);
          return version.length > 0;
        },
        async deleteObject(key) {
          await deletePrivateObject(key);
          // Keep the ledger on failure; retrying an already absent S3 key is safe.
          await tx.delete(uploadIntents).where(eq(uploadIntents.id, candidate.id));
        },
      });
    });
    for (const key of ["scanned", "eligible", "deleted", "skipped", "failed"] as const) totals[key] += result[key];
  }
  return totals;
}
