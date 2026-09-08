export const UNUSED_OBJECT_GRACE_MS = 24 * 60 * 60 * 1000;
export type CleanupCandidate = { id: string; storageKey: string; expiresAt: Date; consumedAt: Date | null };

export async function cleanupUnusedObjects(
  candidates: CleanupCandidate[],
  options: { now: Date; environment: "development" | "production"; dryRun?: boolean },
  dependencies: { isReferenced: (key: string) => Promise<boolean>; deleteObject: (key: string) => Promise<void> },
) {
  const result = { scanned: candidates.length, eligible: 0, deleted: 0, skipped: 0, failed: 0, dryRun: options.dryRun !== false };
  const keyPattern = new RegExp(`^arena/${options.environment}/(?:snapshots/)?[a-f0-9-]{36}$`);
  for (const candidate of candidates) {
    // A consumed intent is NOT automatically safe. Consuming it only means a
    // draft item was created from it; if that draft item was later deleted and
    // the object delete failed, the bytes are orphaned in the bucket with
    // nothing left pointing at them. `isReferenced` — not `consumedAt` — is
    // what decides, and it is re-checked under the row lock before deletion.
    if (!Number.isFinite(candidate.expiresAt.getTime()) || !Number.isFinite(options.now.getTime())
      || candidate.expiresAt.getTime() + UNUSED_OBJECT_GRACE_MS >= options.now.getTime()
      || !keyPattern.test(candidate.storageKey) || await dependencies.isReferenced(candidate.storageKey)) {
      result.skipped++;
      continue;
    }
    result.eligible++;
    if (result.dryRun) continue;
    // The production adapter holds the intent row lock while this runs.
    if (await dependencies.isReferenced(candidate.storageKey)) { result.skipped++; continue; }
    try {
      await dependencies.deleteObject(candidate.storageKey);
      result.deleted++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
