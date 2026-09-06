import { index, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import type { CvResult } from "@/types/cv";
import { arena } from "./schemas";
import { users } from "./identity";

/** Opt-in analysis only. Never store uploaded files or extracted document text. */
export const cvScans = arena.table("cv_scans", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  result: jsonb("result").$type<CvResult>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("cv_scans_user_created_idx").on(table.userId, table.createdAt)]);
