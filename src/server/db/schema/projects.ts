import { boolean, check, index, integer, numeric, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { divisions, weeks } from "./arena-core";
import { difficultyBand, projectPreviewStatus, projectResourceKind, projectStatus, submissionRequirementType } from "./enums";
import { runs } from "./automation";
import { arena } from "./schemas";

export const projects = arena.table("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  weekId: uuid("week_id").notNull().references(() => weeks.id),
  divisionId: uuid("division_id").notNull().references(() => divisions.id),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  shortDescription: text("short_description"),
  difficulty: difficultyBand("difficulty").default("STANDARD").notNull(),
  caseBackground: text("case_background"),
  roleDescription: text("role_description"),
  mission: text("mission"),
  objective: text("objective"),
  estimatedMinutes: integer("estimated_minutes"),
  status: projectStatus("status").default("DRAFT").notNull(),
  scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  previewStatus: projectPreviewStatus("preview_status").default("PENDING").notNull(),
  discordPreviewMessageId: text("discord_preview_message_id"),
  automationRunId: uuid("automation_run_id").references(() => runs.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("projects_week_id_slug_unique").on(table.weekId, table.slug),
  check("projects_estimated_minutes_positive_check", sql`${table.estimatedMinutes} IS NULL OR ${table.estimatedMinutes} > 0`),
  index("projects_week_status_idx").on(table.weekId, table.status),
  index("projects_division_id_idx").on(table.divisionId),
]);

export const skills = arena.table("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique("skills_slug_unique"),
  name: text("name").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectSkills = arena.table("project_skills", {
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id),
  weight: numeric("weight"),
}, (table) => [
  unique("project_skills_project_id_skill_id_unique").on(table.projectId, table.skillId),
  check("project_skills_weight_nonnegative_check", sql`${table.weight} IS NULL OR ${table.weight} >= 0`),
]);

export const projectRubricCriteria = arena.table("project_rubric_criteria", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  /**
   * Which skill this criterion measures, when a curator has said so.
   *
   * Nullable because most existing rubrics predate the link, and an unlinked
   * criterion is an honest "not attributed yet" — finalization records the
   * project score for that skill and labels it PROJECT rather than pretending
   * the criterion measured it.
   */
  skillId: uuid("skill_id").references(() => skills.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  weight: numeric("weight").notNull(),
  maxScore: numeric("max_score").notNull(),
  reviewInstruction: text("review_instruction"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("rubric_criteria_positive_values_check", sql`${table.weight} > 0 AND ${table.maxScore} > 0 AND ${table.sortOrder} >= 0`),
]);

export const projectSubmissionRequirements = arena.table("project_submission_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: submissionRequirementType("type").notNull(),
  required: boolean("required").default(false).notNull(),
  minItems: integer("min_items").default(0).notNull(),
  maxItems: integer("max_items").default(1).notNull(),
  allowedMimeTypes: text("allowed_mime_types").array(),
  allowedLinkTypes: text("allowed_link_types").array(),
  instructions: text("instructions"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("submission_requirements_item_bounds_check", sql`${table.minItems} >= 0 AND ${table.maxItems} >= 0 AND ${table.maxItems} >= ${table.minItems} AND ${table.sortOrder} >= 0`),
]);

/**
 * The materials a participant needs to actually do the task.
 *
 * The generator has produced these since the package schema was written — a
 * dataset link, a template, a reference document — and they were dropped on the
 * way to the database, so a brief could say "analyse the sales dataset" with no
 * dataset anywhere in the product. Storing them alongside the requirements is
 * what makes the brief answerable.
 *
 * URLs are validated as credential-free HTTPS at generation time
 * (packageSchema.resources); the check constraint here is the backstop for
 * anything written by hand or by a migration.
 */
export const projectResources = arena.table("project_resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  /** Presentation only: which icon the list shows. Never a security boundary. */
  kind: projectResourceKind("kind").default("LINK").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("project_resources_https_url_check", sql`${table.url} LIKE 'https://%'`),
  check("project_resources_sort_order_nonnegative_check", sql`${table.sortOrder} >= 0`),
  index("project_resources_project_id_idx").on(table.projectId),
]);
