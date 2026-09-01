import { bigint, boolean, check, index, integer, jsonb, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity";
import { projects, projectSubmissionRequirements } from "./projects";
import { weeks } from "./arena-core";
import { accessStatus, enrollmentStatus, submissionRequirementType, submissionReviewStatus, submissionStatus, workspaceStep } from "./enums";
import { arena } from "./schemas";

export const enrollments = arena.table("enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  weekId: uuid("week_id").notNull().references(() => weeks.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  status: enrollmentStatus("status").default("ACTIVE").notNull(),
  selectedAt: timestamp("selected_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("enrollments_user_id_week_id_unique").on(table.userId, table.weekId),
  index("enrollments_project_id_idx").on(table.projectId),
]);

export const workspaceProgress = arena.table("workspace_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }).unique("workspace_progress_enrollment_id_unique"),
  currentStep: workspaceStep("current_step").default("BRIEF").notNull(),
  planText: text("plan_text"),
  tools: jsonb("tools"),
  taskBreakdown: jsonb("task_breakdown"),
  notes: text("notes"),
  reviewChecklist: jsonb("review_checklist"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const submissions = arena.table("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id).unique("submissions_enrollment_id_unique"),
  userId: uuid("user_id").notNull().references(() => users.id),
  weekId: uuid("week_id").notNull().references(() => weeks.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  status: submissionStatus("status").default("DRAFT").notNull(),
  draftExplanation: text("draft_explanation"),
  draftNotes: text("draft_notes"),
  reviewAttemptsUsed: integer("review_attempts_used").default(0).notNull(),
  latestVersionId: uuid("latest_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("submissions_review_attempts_nonnegative_check", sql`${table.reviewAttemptsUsed} >= 0`),
  index("submissions_user_week_idx").on(table.userId, table.weekId),
]);

export const submissionDraftItems = arena.table("submission_draft_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  requirementId: uuid("requirement_id").references(() => projectSubmissionRequirements.id, { onDelete: "set null" }),
  itemType: submissionRequirementType("item_type").notNull(),
  label: text("label"),
  storageKey: text("storage_key"),
  externalUrl: text("external_url"),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  checksum: text("checksum"),
  textContent: text("text_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("submission_draft_items_size_nonnegative_check", sql`${table.fileSizeBytes} IS NULL OR ${table.fileSizeBytes} >= 0`),
]);

export const submissionVersions = arena.table("submission_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id),
  versionNumber: integer("version_number").notNull(),
  explanation: text("explanation"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
  accessStatus: accessStatus("access_status").default("PENDING").notNull(),
  reviewAttemptNumber: integer("review_attempt_number"),
  reviewStatus: submissionReviewStatus("review_status").default("NOT_QUEUED").notNull(),
  isFinal: boolean("is_final").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("submission_versions_submission_id_version_number_unique").on(table.submissionId, table.versionNumber),
  check("submission_versions_numbers_positive_check", sql`${table.versionNumber} > 0 AND (${table.reviewAttemptNumber} IS NULL OR ${table.reviewAttemptNumber} > 0)`),
  index("submission_versions_submission_submitted_idx").on(table.submissionId, table.submittedAt),
]);

export const submissionVersionItems = arena.table("submission_version_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionVersionId: uuid("submission_version_id").notNull().references(() => submissionVersions.id, { onDelete: "cascade" }),
  requirementId: uuid("requirement_id").references(() => projectSubmissionRequirements.id, { onDelete: "set null" }),
  itemType: submissionRequirementType("item_type").notNull(),
  label: text("label"),
  storageKey: text("storage_key"),
  externalUrl: text("external_url"),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  checksum: text("checksum"),
  textContent: text("text_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("submission_version_items_size_nonnegative_check", sql`${table.fileSizeBytes} IS NULL OR ${table.fileSizeBytes} >= 0`),
]);
