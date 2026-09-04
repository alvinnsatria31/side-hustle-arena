import { index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity";
import { weeks } from "./arena-core";
import { deliveryStatus, notificationChannel, notificationType } from "./enums";
import { notifications } from "./schemas";

export const events = notifications.table("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: notificationType("type").notNull(),
  userId: uuid("user_id").references(() => users.id),
  weekId: uuid("week_id").references(() => weeks.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  actionUrl: text("action_url"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("events_user_created_idx").on(table.userId, table.createdAt),
]);

export const deliveries = notifications.table("deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id),
  channel: notificationChannel("channel").notNull(),
  status: deliveryStatus("status").default("PENDING").notNull(),
  providerReference: text("provider_reference"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("deliveries_status_idx").on(table.status),
]);
