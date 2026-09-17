import { randomUUID } from "node:crypto";

export function createSubmissionObjectKey(environment: "development" | "production") {
  return `arena/${environment}/${randomUUID()}`;
}

export function createSnapshotObjectKey(environment: "development" | "production") {
  return `arena/${environment}/snapshots/${randomUUID()}`;
}

/**
 * Where a shop product's file lives.
 *
 * A separate prefix from `arena/`, because these objects have a different
 * lifetime and a different owner: a submission belongs to one participant and
 * is swept when its retention window closes, while a product file is stock that
 * outlives every order for it. The storage cleanup job walks `arena/` only, so
 * keeping them apart is what stops it from deleting the goods.
 */
export function createStoreProductObjectKey(environment: "development" | "production") {
  return `store/${environment}/${randomUUID()}`;
}
