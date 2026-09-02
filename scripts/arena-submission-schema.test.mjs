import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function expectConstraint(tx, statement) {
  await tx.unsafe("savepoint phase4_constraint");
  try {
    await statement();
    assert.fail("expected a unique constraint violation");
  } catch (error) {
    assert.equal(error.code, "23505");
  } finally {
    await tx.unsafe("rollback to savepoint phase4_constraint");
  }
}

test("submission upload intents and valid review attempts are constrained by the live development schema", async () => {
  assert.equal(process.env.APP_ENV, "development", "schema test requires APP_ENV=development");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured for schema test");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const run = randomUUID();
  try {
    const table = await sql`select to_regclass('arena.upload_intents') as name`;
    assert.equal(table[0].name, "arena.upload_intents");
    await sql.begin(async (tx) => {
      const ids = Object.fromEntries(["user", "division", "week", "project", "enrollment", "submission", "version"].map((key) => [key, randomUUID()]));
      const key = `phase4-${run}`;
      await tx`insert into identity.users (id, auth_subject) values (${ids.user}, ${key})`;
      await tx`insert into arena.divisions (id, slug, name) values (${ids.division}, ${`${key}-division`}, 'Phase 4')`;
      await tx`insert into arena.weeks (id, week_code, title, status, opens_at, submission_deadline_at) values (${ids.week}, ${`${key}-week`}, 'Phase 4', 'OPEN', now() - interval '1 hour', now() + interval '1 hour')`;
      await tx`insert into arena.projects (id, week_id, division_id, slug, title, status) values (${ids.project}, ${ids.week}, ${ids.division}, ${`${key}-project`}, 'Phase 4', 'PUBLISHED')`;
      await tx`insert into arena.enrollments (id, user_id, week_id, project_id) values (${ids.enrollment}, ${ids.user}, ${ids.week}, ${ids.project})`;
      await tx`insert into arena.submissions (id, enrollment_id, user_id, week_id, project_id) values (${ids.submission}, ${ids.enrollment}, ${ids.user}, ${ids.week}, ${ids.project})`;
      await tx`insert into arena.upload_intents (user_id, enrollment_id, submission_id, storage_key, expected_mime_type, expected_size_bytes, original_filename, expires_at) values (${ids.user}, ${ids.enrollment}, ${ids.submission}, ${`${key}-object`}, 'application/pdf', 1, 'draft.pdf', now() + interval '5 minutes')`;
      await expectConstraint(tx, () => tx`insert into arena.upload_intents (user_id, enrollment_id, submission_id, storage_key, expected_mime_type, expected_size_bytes, original_filename, expires_at) values (${ids.user}, ${ids.enrollment}, ${ids.submission}, ${`${key}-object`}, 'application/pdf', 1, 'other.pdf', now() + interval '5 minutes')`);
      await tx`insert into arena.submission_versions (id, submission_id, version_number, submitted_at, review_attempt_number) values (${ids.version}, ${ids.submission}, 1, now(), 1)`;
      await expectConstraint(tx, () => tx`insert into arena.submission_versions (submission_id, version_number, submitted_at, review_attempt_number) values (${ids.submission}, 2, now(), 1)`);
      throw new Error("ROLLBACK_PHASE4_SCHEMA_FIXTURE");
    });
  } catch (error) {
    if (error.message !== "ROLLBACK_PHASE4_SCHEMA_FIXTURE") throw error;
  } finally {
    await sql.end({ timeout: 5 });
  }
});
