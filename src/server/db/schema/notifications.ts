import { index, integer, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
  dedupeKey: text("dedupe_key").unique("events_dedupe_key_unique"),
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
  attemptCount: integer("attempt_count").default(0).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }),
  leaseToken: uuid("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  messageSnapshot: jsonb("message_snapshot").$type<{ from: string; to: string; subject: string; html: string; text: string }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("deliveries_status_idx").on(table.status),
  index("deliveries_email_queue_idx").on(table.channel, table.status, table.availableAt),
]);
