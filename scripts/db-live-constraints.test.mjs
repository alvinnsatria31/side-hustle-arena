import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function requireDevelopmentDatabase() {
  assert.equal(process.env.APP_ENV, "development", "live constraint checks require APP_ENV=development");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured for live constraint checks");
}

async function expectConstraint(tx, expectedConstraint, statement) {
  await tx.unsafe("savepoint constraint_check");
  try {
    await statement();
    assert.fail(`expected ${expectedConstraint} to reject invalid data`);
  } catch (error) {
    assert.equal(error.code, expectedConstraint.endsWith("_check") ? "23514" : "23505", `${expectedConstraint} must be enforced by PostgreSQL`);
  } finally {
    await tx.unsafe("rollback to savepoint constraint_check");
  }
}

test("live Arena uniqueness and core check constraints reject invalid writes", async () => {
  requireDevelopmentDatabase();
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const run = randomUUID().replaceAll("-", "");
  const ids = Object.fromEntries([
    "user1", "user2", "division", "week", "project", "enrollment", "enrollment2", "submission", "submission2", "version", "version2", "review", "criterion", "catalog",
  ].map((name) => [name, randomUUID()]));

  try {
    await sql.begin(async (tx) => {
      const key = (name) => `phase2e-${run}-${name}`;
      await tx`insert into identity.users (id, auth_subject) values (${ids.user1}, ${key("user-1")})`;
      await tx`insert into identity.users (id, auth_subject) values (${ids.user2}, ${key("user-2")})`;
      await expectConstraint(tx, "users_auth_subject_unique", () => tx`insert into identity.users (id, auth_subject) values (${randomUUID()}, ${key("user-1")})`);

      await tx`insert into arena.divisions (id, slug, name) values (${ids.division}, ${key("division")}, 'Phase 2E')`;
      const opensAt = new Date(Date.now() + 60_000);
      const deadlineAt = new Date(Date.now() + 120_000);
      await tx`insert into arena.weeks (id, week_code, title, opens_at, submission_deadline_at) values (${ids.week}, ${key("week")}, 'Phase 2E', ${opensAt}, ${deadlineAt})`;
      await expectConstraint(tx, "weeks_deadline_after_open_check", () => tx`insert into arena.weeks (week_code, title, opens_at, submission_deadline_at) values (${key("invalid-week")}, 'Invalid', ${deadlineAt}, ${opensAt})`);

      await tx`insert into arena.projects (id, week_id, division_id, slug, title) values (${ids.project}, ${ids.week}, ${ids.division}, ${key("project")}, 'Phase 2E')`;
      await tx`insert into arena.enrollments (id, user_id, week_id, project_id) values (${ids.enrollment}, ${ids.user1}, ${ids.week}, ${ids.project})`;
      await tx`insert into arena.enrollments (id, user_id, week_id, project_id) values (${ids.enrollment2}, ${ids.user2}, ${ids.week}, ${ids.project})`;
      await expectConstraint(tx, "enrollments_user_id_week_id_unique", () => tx`insert into arena.enrollments (user_id, week_id, project_id) values (${ids.user1}, ${ids.week}, ${ids.project})`);

      await tx`insert into arena.submissions (id, enrollment_id, user_id, week_id, project_id) values (${ids.submission}, ${ids.enrollment}, ${ids.user1}, ${ids.week}, ${ids.project})`;
      await expectConstraint(tx, "submissions_enrollment_id_unique", () => tx`insert into arena.submissions (enrollment_id, user_id, week_id, project_id) values (${ids.enrollment}, ${ids.user1}, ${ids.week}, ${ids.project})`);
      await expectConstraint(tx, "submissions_review_attempts_nonnegative_check", () => tx`insert into arena.submissions (enrollment_id, user_id, week_id, project_id, review_attempts_used) values (${ids.enrollment2}, ${ids.user2}, ${ids.week}, ${ids.project}, -1)`);

      await tx`insert into arena.submission_versions (id, submission_id, version_number, submitted_at) values (${ids.version}, ${ids.submission}, 1, now())`;
      await tx`insert into arena.submissions (id, enrollment_id, user_id, week_id, project_id) values (${ids.submission2}, ${ids.enrollment2}, ${ids.user2}, ${ids.week}, ${ids.project})`;
      await tx`insert into arena.submission_versions (id, submission_id, version_number, submitted_at) values (${ids.version2}, ${ids.submission2}, 1, now())`;
      await expectConstraint(tx, "submission_versions_submission_id_version_number_unique", () => tx`insert into arena.submission_versions (submission_id, version_number, submitted_at) values (${ids.submission}, 1, now())`);
      await expectConstraint(tx, "submission_versions_numbers_positive_check", () => tx`insert into arena.submission_versions (submission_id, version_number, submitted_at) values (${ids.submission2}, 0, now())`);

      await tx`insert into arena.review_jobs (submission_version_id) values (${ids.version})`;
      await expectConstraint(tx, "review_jobs_submission_version_id_unique", () => tx`insert into arena.review_jobs (submission_version_id) values (${ids.version})`);
      await tx`insert into arena.reviews (id, submission_version_id) values (${ids.review}, ${ids.version})`;
      await expectConstraint(tx, "reviews_submission_version_id_unique", () => tx`insert into arena.reviews (submission_version_id) values (${ids.version})`);
      await expectConstraint(tx, "reviews_score_range_check", () => tx`insert into arena.reviews (submission_version_id, ai_score) values (${ids.version2}, 101)`);

      await tx`insert into arena.project_rubric_criteria (id, project_id, name, weight, max_score) values (${ids.criterion}, ${ids.project}, 'Quality', 1, 100)`;
      await tx`insert into arena.review_scores (review_id, rubric_criterion_id, raw_score, max_score, weighted_score) values (${ids.review}, ${ids.criterion}, 1, 1, 1)`;
      await expectConstraint(tx, "review_scores_review_id_rubric_criterion_id_unique", () => tx`insert into arena.review_scores (review_id, rubric_criterion_id, raw_score, max_score, weighted_score) values (${ids.review}, ${ids.criterion}, 1, 1, 1)`);

      await tx`insert into arena.weekly_rankings (week_id, user_id, project_id, submission_version_id, review_id, final_score, final_submitted_at, rank, points_awarded) values (${ids.week}, ${ids.user1}, ${ids.project}, ${ids.version}, ${ids.review}, 80, now(), 1, 10)`;
      await expectConstraint(tx, "weekly_rankings_week_id_user_id_unique", () => tx`insert into arena.weekly_rankings (week_id, user_id, project_id, submission_version_id, review_id, final_score, final_submitted_at, rank, points_awarded) values (${ids.week}, ${ids.user1}, ${ids.project}, ${ids.version}, ${ids.review}, 80, now(), 2, 10)`);
      await expectConstraint(tx, "weekly_rankings_week_id_rank_unique", () => tx`insert into arena.weekly_rankings (week_id, user_id, project_id, submission_version_id, review_id, final_score, final_submitted_at, rank, points_awarded) values (${ids.week}, ${ids.user2}, ${ids.project}, ${ids.version}, ${ids.review}, 80, now(), 1, 10)`);
      await expectConstraint(tx, "weekly_rankings_values_check", () => tx`insert into arena.weekly_rankings (week_id, user_id, project_id, submission_version_id, review_id, final_score, final_submitted_at, rank, points_awarded) values (${ids.week}, ${ids.user2}, ${ids.project}, ${ids.version}, ${ids.review}, 101, now(), 2, 10)`);

      await tx`insert into rewards.point_ledger (user_id, amount, entry_type, idempotency_key) values (${ids.user1}, 1, 'ADMIN_ADJUSTMENT'::rewards.point_ledger_entry_type, ${key("ledger")})`;
      await expectConstraint(tx, "point_ledger_idempotency_key_unique", () => tx`insert into rewards.point_ledger (user_id, amount, entry_type, idempotency_key) values (${ids.user1}, 1, 'ADMIN_ADJUSTMENT'::rewards.point_ledger_entry_type, ${key("ledger")})`);

      await tx`insert into rewards.catalog (id, slug, title, points_cost, reward_type) values (${ids.catalog}, ${key("catalog")}, 'Phase 2E', 1, 'DIGITAL'::rewards.reward_type)`;
      await tx`insert into rewards.redemptions (user_id, reward_id, points_spent, idempotency_key) values (${ids.user1}, ${ids.catalog}, 1, ${key("redemption")})`;
      await expectConstraint(tx, "redemptions_idempotency_key_unique", () => tx`insert into rewards.redemptions (user_id, reward_id, points_spent, idempotency_key) values (${ids.user1}, ${ids.catalog}, 1, ${key("redemption")})`);
      await expectConstraint(tx, "redemptions_points_spent_positive_check", () => tx`insert into rewards.redemptions (user_id, reward_id, points_spent, idempotency_key) values (${ids.user1}, ${ids.catalog}, 0, ${key("invalid-redemption")})`);

      await tx`insert into automation.runs (type, idempotency_key) values ('PROJECT_GENERATION'::automation.automation_run_type, ${key("run")})`;
      await expectConstraint(tx, "runs_idempotency_key_unique", () => tx`insert into automation.runs (type, idempotency_key) values ('PROJECT_GENERATION'::automation.automation_run_type, ${key("run")})`);
      await expectConstraint(tx, "runs_counts_nonnegative_check", () => tx`insert into automation.runs (type, idempotency_key, items_total) values ('PROJECT_GENERATION'::automation.automation_run_type, ${key("invalid-run")}, -1)`);

      throw new Error("ROLLBACK_LIVE_CONSTRAINT_FIXTURE");
    });
  } catch (error) {
    if (error.message !== "ROLLBACK_LIVE_CONSTRAINT_FIXTURE") throw error;
  } finally {
    await sql.end({ timeout: 5 });
  }
});
