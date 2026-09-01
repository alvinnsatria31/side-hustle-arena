import { boolean, check, index, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity";
import { weeks } from "./arena-core";
import { inventoryMode, pointLedgerEntryType, redemptionStatus, rewardType } from "./enums";
import { rewards } from "./schemas";

export const pointAccounts = rewards.table("point_accounts", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  balance: integer("balance").default(0).notNull(),
  lifetimeEarned: integer("lifetime_earned").default(0).notNull(),
  lifetimeSpent: integer("lifetime_spent").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("point_accounts_nonnegative_check", sql`${table.balance} >= 0 AND ${table.lifetimeEarned} >= 0 AND ${table.lifetimeSpent} >= 0`),
]);

export const pointLedger = rewards.table("point_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  entryType: pointLedgerEntryType("entry_type").notNull(),
  weekId: uuid("week_id").references(() => weeks.id),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  description: text("description"),
  idempotencyKey: text("idempotency_key").notNull().unique("point_ledger_idempotency_key_unique"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("point_ledger_user_created_idx").on(table.userId, table.createdAt),
]);

export const catalog = rewards.table("catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique("catalog_slug_unique"),
  title: text("title").notNull(),
  description: text("description"),
  pointsCost: integer("points_cost").notNull(),
  rewardType: rewardType("reward_type").notNull(),
  monetaryValueMinor: integer("monetary_value_minor"),
  currency: text("currency"),
  inventoryMode: inventoryMode("inventory_mode").default("UNLIMITED").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("catalog_cost_and_value_check", sql`${table.pointsCost} > 0 AND (${table.monetaryValueMinor} IS NULL OR ${table.monetaryValueMinor} >= 0)`),
]);

export const inventoryPeriods = rewards.table("inventory_periods", {
  id: uuid("id").defaultRandom().primaryKey(),
  rewardId: uuid("reward_id").notNull().references(() => catalog.id),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  quantityTotal: integer("quantity_total").notNull(),
  quantityReserved: integer("quantity_reserved").default(0).notNull(),
  quantityFulfilled: integer("quantity_fulfilled").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("inventory_periods_values_check", sql`${table.periodEnd} > ${table.periodStart} AND ${table.quantityTotal} >= 0 AND ${table.quantityReserved} >= 0 AND ${table.quantityFulfilled} >= 0 AND ${table.quantityReserved} <= ${table.quantityTotal} AND ${table.quantityFulfilled} <= ${table.quantityTotal}`),
]);

export const redemptions = rewards.table("redemptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  rewardId: uuid("reward_id").notNull().references(() => catalog.id),
  inventoryPeriodId: uuid("inventory_period_id").references(() => inventoryPeriods.id),
  pointsSpent: integer("points_spent").notNull(),
  status: redemptionStatus("status").default("PENDING").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique("redemptions_idempotency_key_unique"),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).defaultNow().notNull(),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  fulfillmentReference: text("fulfillment_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("redemptions_points_spent_positive_check", sql`${table.pointsSpent} > 0`),
  index("redemptions_user_status_idx").on(table.userId, table.status),
]);
