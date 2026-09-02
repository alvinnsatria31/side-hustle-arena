import { randomUUID } from "node:crypto";

export function createSubmissionObjectKey(environment: "development" | "production") {
  return `arena/${environment}/${randomUUID()}`;
}
