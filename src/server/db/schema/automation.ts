import { check, index, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { automationRunStatus, automationRunType } from "./enums";
import { weeks } from "./arena-core";
import { automation } from "./schemas";

export const runs = automation.table("runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: automationRunType("type").notNull(),
  weekId: uuid("week_id").references(() => weeks.id),
  status: automationRunStatus("status").default("PENDING").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique("runs_idempotency_key_unique"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  itemsTotal: integer("items_total").default(0).notNull(),
  itemsSuccess: integer("items_success").default(0).notNull(),
  itemsFailed: integer("items_failed").default(0).notNull(),
  errorSummary: text("error_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("runs_counts_nonnegative_check", sql`${table.itemsTotal} >= 0 AND ${table.itemsSuccess} >= 0 AND ${table.itemsFailed} >= 0`),
  index("runs_type_status_idx").on(table.type, table.status),
]);
