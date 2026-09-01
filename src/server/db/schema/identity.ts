import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userStatus } from "./enums";
import { identity } from "./schemas";

export const users = identity.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  authSubject: text("auth_subject").notNull().unique("users_auth_subject_unique"),
  emailCache: text("email_cache"),
  displayNameCache: text("display_name_cache"),
  avatarUrlCache: text("avatar_url_cache"),
  status: userStatus("status").default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});
