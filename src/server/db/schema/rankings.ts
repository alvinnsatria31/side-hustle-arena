import { check, index, integer, numeric, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity";
import { projects } from "./projects";
import { reviews } from "./reviews";
import { submissionVersions } from "./submissions";
import { weeks } from "./arena-core";
import { arena } from "./schemas";

export const weeklyRankings = arena.table("weekly_rankings", {
  id: uuid("id").defaultRandom().primaryKey(),
  weekId: uuid("week_id").notNull().references(() => weeks.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  submissionVersionId: uuid("submission_version_id").notNull().references(() => submissionVersions.id),
  reviewId: uuid("review_id").notNull().references(() => reviews.id),
  finalScore: numeric("final_score").notNull(),
  finalSubmittedAt: timestamp("final_submitted_at", { withTimezone: true }).notNull(),
  rank: integer("rank").notNull(),
  pointsAwarded: integer("points_awarded").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("weekly_rankings_week_id_user_id_unique").on(table.weekId, table.userId),
  unique("weekly_rankings_week_id_rank_unique").on(table.weekId, table.rank),
  check("weekly_rankings_values_check", sql`${table.rank} > 0 AND ${table.finalScore} >= 0 AND ${table.finalScore} <= 100 AND ${table.pointsAwarded} >= 0`),
  index("weekly_rankings_week_rank_idx").on(table.weekId, table.rank),
  index("weekly_rankings_leaderboard_idx").on(table.weekId, table.finalScore, table.finalSubmittedAt),
]);
