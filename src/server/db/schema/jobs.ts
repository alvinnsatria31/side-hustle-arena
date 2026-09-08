import { bigint, boolean, check, index, integer, jsonb, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./projects";
import { jobEmploymentType, jobOpeningStatus, jobSkillKind, jobSyncStatus, jobWorkMode } from "./enums";
import { arena } from "./schemas";

/**
 * A place openings come from.
 *
 * Provider-agnostic on purpose: which board Sekolah Karir partners with is a
 * business decision that has not been made, and the pipeline must not wait for
 * it. A source is a row here plus an adapter name plus non-secret config; the
 * credential is referenced BY ENV VAR NAME (`credentialEnvVar`) and never
 * stored, so a database dump can never leak an API key and an operator can
 * rotate one without a migration.
 */
export const jobSources = arena.table("job_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique("job_sources_slug_unique"),
  name: text("name").notNull(),
  /** Which adapter reads this source. See `src/server/career/jobs/adapters`. */
  adapter: text("adapter").notNull(),
  /** Non-secret wiring: base URL, pagination shape, field mapping, header names. */
  config: jsonb("config").notNull(),
  /** NAME of the environment variable holding the token. Never the token. */
  credentialEnvVar: text("credential_env_var"),
  isActive: boolean("is_active").default(false).notNull(),
  syncIntervalMinutes: integer("sync_interval_minutes").default(360).notNull(),
  /** Days an opening may go unseen in the feed before it is closed. */
  stalenessDays: integer("staleness_days").default(7).notNull(),
  /** Resume point for the next incremental sync; null means start from the top. */
  cursor: text("cursor"),
  lastSyncStartedAt: timestamp("last_sync_started_at", { withTimezone: true }),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  /** Single-writer lease: two workers must never sync one source at once. */
  leaseToken: uuid("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("job_sources_interval_positive_check", sql`${table.syncIntervalMinutes} > 0 AND ${table.stalenessDays} > 0`),
  check("job_sources_failures_nonnegative_check", sql`${table.consecutiveFailures} >= 0`),
  index("job_sources_active_idx").on(table.isActive, table.lastSuccessfulSyncAt),
]);

/**
 * One normalized opening.
 *
 * `(sourceId, externalId)` is the provider's identity and the upsert target, so
 * re-running a sync updates rather than duplicates. `canonicalKey` is OUR
 * identity — a normalized title+company+location fingerprint — which is what
 * lets the same role appearing on two boards be recognised as one job later
 * without pretending the provider ids are comparable.
 *
 * Openings are never deleted when they vanish from a feed. A feed can drop an
 * item because the role closed, or because a page failed, or because the
 * provider changed its filters; deleting on absence would silently erase
 * history in the last two cases. They move through an explicit lifecycle
 * instead, and `lastSeenAt` records what we actually observed.
 */
export const jobOpenings = arena.table("job_openings", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  canonicalKey: text("canonical_key").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  workMode: jobWorkMode("work_mode").default("UNSPECIFIED").notNull(),
  employmentType: jobEmploymentType("employment_type").default("UNSPECIFIED").notNull(),
  description: text("description"),
  /** Provider-reported skill names, before taxonomy resolution. */
  requiredSkills: text("required_skills").array().default(sql`'{}'::text[]`).notNull(),
  preferredSkills: text("preferred_skills").array().default(sql`'{}'::text[]`).notNull(),
  applicationUrl: text("application_url").notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  salaryMin: bigint("salary_min", { mode: "number" }),
  salaryMax: bigint("salary_max", { mode: "number" }),
  salaryCurrency: text("salary_currency"),
  salaryPeriod: text("salary_period"),
  status: jobOpeningStatus("status").default("OPEN").notNull(),
  /** Hash of the normalized payload: an unchanged provider record is a no-op. */
  contentHash: text("content_hash").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("job_openings_source_id_external_id_unique").on(table.sourceId, table.externalId),
  check("job_openings_salary_range_check", sql`${table.salaryMin} IS NULL OR ${table.salaryMax} IS NULL OR ${table.salaryMin} <= ${table.salaryMax}`),
  check("job_openings_application_url_https_check", sql`${table.applicationUrl} LIKE 'https://%'`),
  index("job_openings_status_seen_idx").on(table.status, table.lastSeenAt),
  index("job_openings_canonical_key_idx").on(table.canonicalKey),
  index("job_openings_source_seen_idx").on(table.sourceId, table.lastSeenAt),
]);

/**
 * Resolved taxonomy links, so matching compares skill IDs rather than strings.
 *
 * A provider's "MS Excel" and Arena's "Excel" are the same skill; comparing raw
 * text made that a miss and produced a confidently wrong 0% coverage. Rows are
 * written only where an alias actually resolved — an unresolved provider skill
 * stays in `requiredSkills` as unmatched text rather than being invented into
 * the taxonomy.
 */
export const jobOpeningSkills = arena.table("job_opening_skills", {
  jobOpeningId: uuid("job_opening_id").notNull().references(() => jobOpenings.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  kind: jobSkillKind("kind").notNull(),
  /** The provider text that resolved to this skill, kept for auditability. */
  matchedAlias: text("matched_alias").notNull(),
}, (table) => [
  unique("job_opening_skills_opening_skill_kind_unique").on(table.jobOpeningId, table.skillId, table.kind),
  index("job_opening_skills_skill_idx").on(table.skillId),
]);

/**
 * The alias table that unifies skill vocabulary across Arena, Career Report,
 * CV and Jobs. One taxonomy, many spellings.
 */
export const skillAliases = arena.table("skill_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  /** Normalized (casefolded, punctuation-stripped) form; the lookup key. */
  alias: text("alias").notNull().unique("skill_aliases_alias_unique"),
  /** Where the alias came from: 'canonical', 'manual', 'cv', 'jobs'. */
  source: text("source").default("manual").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("skill_aliases_skill_idx").on(table.skillId),
]);

/** One sync attempt, kept whether it succeeded or not. */
export const jobSyncRuns = arena.table("job_sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id, { onDelete: "cascade" }),
  status: jobSyncStatus("status").default("RUNNING").notNull(),
  /** Who asked: 'scheduler', 'admin:<subject>', 'n8n'. */
  triggeredBy: text("triggered_by").notNull(),
  /** Repeating a trigger with the same key resumes rather than duplicating. */
  idempotencyKey: text("idempotency_key").notNull().unique("job_sync_runs_idempotency_key_unique"),
  cursorBefore: text("cursor_before"),
  cursorAfter: text("cursor_after"),
  pagesFetched: integer("pages_fetched").default(0).notNull(),
  itemsSeen: integer("items_seen").default(0).notNull(),
  itemsCreated: integer("items_created").default(0).notNull(),
  itemsUpdated: integer("items_updated").default(0).notNull(),
  itemsUnchanged: integer("items_unchanged").default(0).notNull(),
  itemsInvalid: integer("items_invalid").default(0).notNull(),
  itemsClosed: integer("items_closed").default(0).notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("job_sync_runs_source_started_idx").on(table.sourceId, table.startedAt),
]);
