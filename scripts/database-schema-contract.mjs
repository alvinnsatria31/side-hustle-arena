import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationRoot = join(process.cwd(), "drizzle");

function findSqlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findSqlFiles(path) : entry.name.endsWith(".sql") ? [path] : [];
  });
}

const sql = findSqlFiles(migrationRoot)
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

for (const schema of ["identity", "arena", "rewards", "notifications", "automation", "audit"]) {
  assert.match(sql, new RegExp(`CREATE SCHEMA \\\"${schema}\\\"`));
}

assert.match(sql, /CREATE TYPE "arena"\."week_status" AS ENUM/);
assert.match(sql, /timestamp with time zone/);
assert.match(sql, /FOREIGN KEY/);
assert.match(sql, /CREATE INDEX/);
assert.match(sql, /CHECK \(/);

for (const fragment of [
  '"users_auth_subject_unique" UNIQUE("auth_subject")',
  '"enrollments_user_id_week_id_unique" UNIQUE("user_id","week_id")',
  '"submissions_enrollment_id_unique" UNIQUE("enrollment_id")',
  '"submission_versions_submission_id_version_number_unique" UNIQUE("submission_id","version_number")',
  '"review_jobs_submission_version_id_unique" UNIQUE("submission_version_id")',
  '"reviews_submission_version_id_unique" UNIQUE("submission_version_id")',
  '"review_scores_review_id_rubric_criterion_id_unique" UNIQUE("review_id","rubric_criterion_id")',
  '"weekly_rankings_week_id_user_id_unique" UNIQUE("week_id","user_id")',
  '"weekly_rankings_week_id_rank_unique" UNIQUE("week_id","rank")',
  '"point_ledger_idempotency_key_unique" UNIQUE("idempotency_key")',
  '"redemptions_idempotency_key_unique" UNIQUE("idempotency_key")',
  '"runs_idempotency_key_unique" UNIQUE("idempotency_key")',
]) {
  assert.ok(sql.includes(fragment), `missing schema contract: ${fragment}`);
}

assert.doesNotMatch(sql, /\b(password|password_hash|reset_token|bytea|blob)\b/i);
assert.doesNotMatch(sql, /NEXT_PUBLIC_DATABASE_URL/);

console.log("Database schema contract passed.");
