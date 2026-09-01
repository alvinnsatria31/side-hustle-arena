import { boolean, check, index, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { leaderboardScope, tieBreakMethod, weekStatus } from "./enums";
import { arena } from "./schemas";

export const divisions = arena.table("divisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique("divisions_slug_unique"),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const weeks = arena.table("weeks", {
  id: uuid("id").defaultRandom().primaryKey(),
  weekCode: text("week_code").notNull().unique("weeks_week_code_unique"),
  title: text("title").notNull(),
  status: weekStatus("status").default("DRAFT").notNull(),
  previewAt: timestamp("preview_at", { withTimezone: true }),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
  submissionDeadlineAt: timestamp("submission_deadline_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  finalizationStartedAt: timestamp("finalization_started_at", { withTimezone: true }),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  timezone: text("timezone").default("Asia/Jakarta").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("weeks_deadline_after_open_check", sql`${table.submissionDeadlineAt} > ${table.opensAt}`),
  index("weeks_status_opens_idx").on(table.status, table.opensAt),
]);

export const weekRules = arena.table("week_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  weekId: uuid("week_id").notNull().references(() => weeks.id).unique("week_rules_week_id_unique"),
  maxProjectsPerUser: integer("max_projects_per_user").default(1).notNull(),
  maxReviewAttempts: integer("max_review_attempts").default(3).notNull(),
  allowLateSubmission: boolean("allow_late_submission").default(false).notNull(),
  leaderboardScope: leaderboardScope("leaderboard_scope").default("GLOBAL").notNull(),
  tieBreakMethod: tieBreakMethod("tie_break_method").default("EARLIEST_FINAL_SUBMISSION").notNull(),
  rank1Points: integer("rank_1_points").default(300).notNull(),
  rank2Points: integer("rank_2_points").default(200).notNull(),
  rank3Points: integer("rank_3_points").default(150).notNull(),
  completionPoints: integer("completion_points").default(100).notNull(),
  difficultyBand: text("difficulty_band").default("STANDARD").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("week_rules_max_projects_positive_check", sql`${table.maxProjectsPerUser} > 0`),
  check("week_rules_max_attempts_positive_check", sql`${table.maxReviewAttempts} > 0`),
  check("week_rules_points_nonnegative_check", sql`${table.rank1Points} >= 0 AND ${table.rank2Points} >= 0 AND ${table.rank3Points} >= 0 AND ${table.completionPoints} >= 0`),
]);
