import { ArenaDomainError } from "@/server/arena/errors";

/**
 * Version items must never point at a draft object.
 *
 * A presigned PUT stays valid for its whole TTL, so the object a draft item
 * references can be replaced after the participant hits submit — same size,
 * same content-type, different bytes. If the version row copied that key, the
 * reviewer would grade whatever happened to be there at claim time.
 *
 * So submit freezes every FILE item into a write-once snapshot object first,
 * and the version row references the snapshot key plus the checksum of the
 * exact bytes that were frozen. This module holds the part of that rule that
 * is pure decision-making, so it can be tested without storage or a database.
 */

export interface VersionSourceItem {
  id: string;
  itemType: "FILE" | "LINK" | "TEXT";
  storageKey: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  checksum: string | null;
}

export interface FrozenArtifact {
  storageKey: string;
  checksum: string;
  sizeBytes: number;
}

/** FILE items carrying an object key are the ones that need freezing. */
export function planVersionSnapshots<T extends VersionSourceItem>(items: T[]): T[] {
  return items.filter((item) => item.itemType === "FILE" && Boolean(item.storageKey));
}

/**
 * Resolve the storage reference a version item must persist.
 *
 * Fails loudly for a FILE item without a snapshot rather than falling through
 * to the draft key: a silent fall-through is exactly the bug this exists to
 * prevent, and it would be invisible until a reviewer read replaced bytes.
 */
export function resolveVersionItemStorage(
  item: VersionSourceItem,
  snapshots: ReadonlyMap<string, FrozenArtifact>,
): { storageKey: string | null; checksum: string | null; fileSizeBytes: number | null } {
  if (item.itemType !== "FILE" || !item.storageKey) {
    return { storageKey: null, checksum: item.checksum ?? null, fileSizeBytes: item.fileSizeBytes ?? null };
  }
  const frozen = snapshots.get(item.id);
  if (!frozen) {
    throw new ArenaDomainError("UPLOAD_VALIDATION_FAILED", "Submitted file could not be frozen for review.");
  }
  if (frozen.storageKey === item.storageKey) {
    throw new ArenaDomainError("UPLOAD_VALIDATION_FAILED", "Submitted file snapshot must not reuse the draft object key.");
  }
  return { storageKey: frozen.storageKey, checksum: frozen.checksum, fileSizeBytes: frozen.sizeBytes };
}

/**
 * Does a stored artifact still match what was submitted?
 *
 * Size alone is not identity: an attacker replaying a presigned PUT controls
 * the byte count, so equal length proves nothing. The recorded checksum is the
 * only thing that does, and a version item written without one is treated as
 * unverifiable rather than as "probably fine".
 */
export function assertArtifactIdentity(
  expected: { storageKey: string | null; checksum: string | null; fileSizeBytes: number | null },
  actual: { checksum: string; sizeBytes: number },
): void {
  if (!expected.checksum) {
    throw new ArenaDomainError("UPLOAD_VALIDATION_FAILED", "Stored artifact has no recorded checksum to verify against.");
  }
  if (expected.fileSizeBytes != null && expected.fileSizeBytes !== actual.sizeBytes) {
    throw new ArenaDomainError("UPLOAD_VALIDATION_FAILED", "Stored artifact size changed since submission.");
  }
  if (expected.checksum.toLowerCase() !== actual.checksum.toLowerCase()) {
    throw new ArenaDomainError("UPLOAD_VALIDATION_FAILED", "Stored artifact content changed since submission.");
  }
}
