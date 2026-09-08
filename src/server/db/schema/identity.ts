import { index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userStatus } from "./enums";
import { identity } from "./schemas";

export const users = identity.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  authSubject: text("auth_subject").notNull().unique("users_auth_subject_unique"),
  emailCache: text("email_cache"),
  displayNameCache: text("display_name_cache"),
  avatarUrlCache: text("avatar_url_cache"),
  /**
   * The preset avatar the participant picked in the Arena (src/lib/avatars.ts).
   *
   * Null means "never picked", which is what raises the one-time picker on
   * arrival — so it is deliberately nullable rather than defaulted. Distinct
   * from `avatar_url_cache`, which mirrors whatever the main site holds and is
   * not ours to write; this column is Arena-owned display identity.
   */
  avatarId: text("avatar_id"),
  status: userStatus("status").default("ACTIVE").notNull(),
  /**
   * When this participant agreed to appear in the public Showcase.
   *
   * Null — the default, and the state every existing row starts in — means no.
   * Consent is a positive act with a timestamp on it, never an inference from
   * having ranked well, so the showcase publishes nobody until they say yes.
   * The leaderboard is a separate, PRD-mandated public surface and is not
   * governed by this column.
   */
  showcaseConsentAt: timestamp("showcase_consent_at", { withTimezone: true }),
  /** Where the consent was given, e.g. "profile". Auditable, not identifying. */
  showcaseConsentSource: text("showcase_consent_source"),
  /**
   * When the participant asked for their account to be deleted.
   *
   * Deletion is staged rather than immediate: the row is anonymised at once and
   * the identifying caches are cleared, while ledger and ranking history stay
   * so the leaderboard of a finalized week does not silently change shape.
   */
  deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
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
