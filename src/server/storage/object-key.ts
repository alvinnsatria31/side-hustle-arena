import { randomUUID } from "node:crypto";

export function createSubmissionObjectKey(environment: "development" | "production") {
  return `arena/${environment}/${randomUUID()}`;
}

export function createSnapshotObjectKey(environment: "development" | "production") {
  return `arena/${environment}/snapshots/${randomUUID()}`;
}
