import { check, index, integer, jsonb, numeric, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { desc, sql } from "drizzle-orm";
import { runs } from "./automation";
import { users } from "./identity";
import { projects, projectRubricCriteria, skills } from "./projects";
import { submissionVersions } from "./submissions";
import { weeks } from "./arena-core";
import { reviewJobStatus, reviewStatus } from "./enums";
import { arena } from "./schemas";

export const reviewJobs = arena.table("review_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionVersionId: uuid("submission_version_id").notNull().references(() => submissionVersions.id).unique("review_jobs_submission_version_id_unique"),
  status: reviewJobStatus("status").default("PENDING").notNull(),
  priority: integer("priority").default(0).notNull(),
  attemptCount: integer("attempt_count").default(0).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("review_jobs_attempt_count_nonnegative_check", sql`${table.attemptCount} >= 0`),
  index("review_jobs_claim_idx").on(table.status, desc(table.priority), table.availableAt),
]);

export const reviews = arena.table("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionVersionId: uuid("submission_version_id").notNull().references(() => submissionVersions.id),
  // Run number supports audited admin reruns (PRD §31): each rerun inserts a
  // new row with an incremented run number. Old rows are never mutated or
  // deleted — the original review stays queryable forever.
  runNumber: integer("run_number").default(1).notNull(),
  automationRunId: uuid("automation_run_id").references(() => runs.id),
  status: reviewStatus("status").default("PROCESSING").notNull(),
  aiScore: numeric("ai_score"),
  finalScore: numeric("final_score"),
  summary: text("summary"),
  strengths: jsonb("strengths"),
  improvements: jsonb("improvements"),
  reviewConfidence: numeric("review_confidence"),
  reviewModel: text("review_model"),
  reviewModelVersion: text("review_model_version"),
  promptVersion: text("prompt_version"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("reviews_score_range_check", sql`(${table.aiScore} IS NULL OR (${table.aiScore} >= 0 AND ${table.aiScore} <= 100)) AND (${table.finalScore} IS NULL OR (${table.finalScore} >= 0 AND ${table.finalScore} <= 100)) AND (${table.reviewConfidence} IS NULL OR (${table.reviewConfidence} >= 0 AND ${table.reviewConfidence} <= 1))`),
  check("reviews_run_number_positive_check", sql`${table.runNumber} > 0`),
  index("reviews_status_idx").on(table.status),
  unique("reviews_submission_version_run_unique").on(table.submissionVersionId, table.runNumber),
]);

export const reviewScores = arena.table("review_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  reviewId: uuid("review_id").notNull().references(() => reviews.id),
  rubricCriterionId: uuid("rubric_criterion_id").notNull().references(() => projectRubricCriteria.id),
  rawScore: numeric("raw_score").notNull(),
  maxScore: numeric("max_score").notNull(),
  weightedScore: numeric("weighted_score").notNull(),
  feedback: text("feedback"),
  evidence: jsonb("evidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("review_scores_review_id_rubric_criterion_id_unique").on(table.reviewId, table.rubricCriterionId),
  check("review_scores_valid_values_check", sql`${table.rawScore} >= 0 AND ${table.maxScore} > 0 AND ${table.weightedScore} >= 0`),
]);

export const reviewArtifacts = arena.table("review_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionVersionId: uuid("submission_version_id").notNull().references(() => submissionVersions.id),
  sourceId: text("source_id").notNull(),
  kind: text("kind").notNull(),
  sha256: text("sha256").notNull(),
  extractedText: text("extracted_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("review_artifacts_version_source_unique").on(table.submissionVersionId, table.sourceId)]);

export const reviewOverrides = arena.table("review_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  reviewId: uuid("review_id").notNull().references(() => reviews.id),
  adminSubject: text("admin_subject").notNull(),
  previousScore: numeric("previous_score"),
  newScore: numeric("new_score").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("review_overrides_score_range_check", sql`(${table.previousScore} IS NULL OR (${table.previousScore} >= 0 AND ${table.previousScore} <= 100)) AND ${table.newScore} >= 0 AND ${table.newScore} <= 100`),
]);

export const skillEvidence = arena.table("skill_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  weekId: uuid("week_id").notNull().references(() => weeks.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  reviewId: uuid("review_id").notNull().references(() => reviews.id),
  skillId: uuid("skill_id").notNull().references(() => skills.id),
  score: numeric("score").notNull(),
  evidenceSummary: text("evidence_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("skill_evidence_review_id_skill_id_unique").on(table.reviewId, table.skillId),
  check("skill_evidence_score_range_check", sql`${table.score} >= 0 AND ${table.score} <= 100`),
  index("skill_evidence_user_created_idx").on(table.userId, table.createdAt),
  index("skill_evidence_skill_id_idx").on(table.skillId),
  index("skill_evidence_review_id_idx").on(table.reviewId),
]);
