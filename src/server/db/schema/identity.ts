import { index, text, timestamp, uuid } from "drizzle-orm/pg-core";
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

export const sessions = identity.table(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    tokenHash: text("token_hash").notNull().unique("identity_sessions_token_hash_unique"),
    canonicalGrantId: text("canonical_grant_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastCanonicalCheckAt: timestamp("last_canonical_check_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => [
    index("identity_sessions_user_idx").on(table.userId),
    index("identity_sessions_expiry_idx").on(table.expiresAt),
    index("identity_sessions_grant_idx").on(table.canonicalGrantId),
  ],
);
