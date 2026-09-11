import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { jobOpeningSkills, jobOpenings, jobSources, jobSyncRuns, skillAliases, skills } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";
import { EXECUTION_CONTRACT, createExecutionBudget, isDeadlineError, type ExecutionBudget } from "@/server/ops/execution-budget";
import { fieldMapSchema, type JobsAdapter } from "./contract";
import { createHttpJsonAdapter, JobsFeedError } from "./http-adapter";
import { createFixtureAdapter, FIXTURE_ADAPTER_NAME } from "./fixture-adapter";
import { isLocalSandboxEnvironment } from "@/server/dev/guard";
import { normalizeOpening, type NormalizedOpening } from "./normalize";
import { buildSkillIndex, type SkillIndex } from "../skill-taxonomy";
import {
  classifyRun, emptyTotals, isSourceDue, planAbsence, planUpsert,
  type ExistingOpening, type SyncTotals,
} from "./sync-core";

type Db = ReturnType<typeof getDb>;
type SourceRow = typeof jobSources.$inferSelect;

/** How long one worker owns a source. Longer than a sync, shorter than a nap. */
export const SOURCE_LEASE_MS = 10 * 60_000;

const adapters: Record<string, () => JobsAdapter> = {
  "http-json": () => createHttpJsonAdapter(),
  // Refuses to run outside the local sandbox; see fixture-adapter.ts.
  [FIXTURE_ADAPTER_NAME]: () => createFixtureAdapter(),
};

/**
 * Adapters are looked up by name, and an unknown name is an error rather than
 * a silent skip: a source row that names an adapter nobody implemented would
 * otherwise sit "active" and never sync, reporting nothing wrong.
 */
export function resolveAdapter(name: string, overrides?: Record<string, JobsAdapter>): JobsAdapter {
  const override = overrides?.[name];
  if (override) return override;
  const factory = adapters[name];
  if (!factory) throw new ArenaDomainError("VALIDATION_ERROR", `No jobs adapter named "${name}" is registered.`);
  return factory();
}

/**
 * Credentials live in the environment, referenced by name.
 *
 * The source row stores WHICH variable, never the value, so nothing secret
 * reaches a database dump, an audit row, an admin screen or this module's
 * return values. A named-but-missing variable is a hard error: syncing a
 * private feed unauthenticated would produce an empty page, and an empty page
 * looks exactly like "every job closed".
 */
export function resolveCredential(source: Pick<SourceRow, "credentialEnvVar" | "slug">, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!source.credentialEnvVar) return undefined;
  const value = env[source.credentialEnvVar];
  if (!value) {
    throw new ArenaDomainError("VALIDATION_ERROR", `Source "${source.slug}" needs ${source.credentialEnvVar}, which is not set.`);
  }
  return value;
}

/**
 * The loopback exception in `httpJsonSourceConfigSchema` exists so a local
 * fixture server can exercise the ingestion path. It must not travel: outside
 * the sandbox, a plaintext feed means credentials and listings crossing the
 * network in the clear, and a `localhost` base URL in a deployed environment
 * points at the deployment itself.
 */
export function assertFeedTransportAllowed(config: unknown, env: NodeJS.ProcessEnv = process.env): void {
  const baseUrl = (config as { baseUrl?: unknown }).baseUrl;
  if (typeof baseUrl !== "string") return;
  let protocol: string;
  try { protocol = new URL(baseUrl).protocol; } catch { return; }
  if (protocol === "https:") return;
  if (!isLocalSandboxEnvironment(env)) {
    throw new ArenaDomainError("VALIDATION_ERROR", "A non-HTTPS jobs feed is only allowed in the local sandbox.");
  }
}

/**
 * The shared taxonomy index — the same one Career Report and CV matching use,
 * so a skill name means one thing across the product.
 */
async function loadSkillIndex(db: Db): Promise<SkillIndex> {
  const [skillRows, aliasRows] = await Promise.all([
    db.select({ id: skills.id, name: skills.name, slug: skills.slug }).from(skills),
    db.select({ skillId: skillAliases.skillId, alias: skillAliases.alias }).from(skillAliases),
  ]);
  return buildSkillIndex(skillRows, aliasRows);
}

async function writeOpeningSkills(db: Db, openingId: string, opening: NormalizedOpening, index: SkillIndex) {
  const rows: Array<typeof jobOpeningSkills.$inferInsert> = [];
  const seen = new Set<string>();
  for (const [kind, names] of [["REQUIRED", opening.requiredSkills], ["PREFERRED", opening.preferredSkills]] as const) {
    for (const name of names) {
      const skillId = index.resolve(name);
      // An unresolved provider skill is left as unmatched text on the opening.
      // Inventing a taxonomy entry for it would make coverage look better than
      // the evidence supports, which is the whole failure mode to avoid.
      if (!skillId || seen.has(`${kind}:${skillId}`)) continue;
      seen.add(`${kind}:${skillId}`);
      rows.push({ jobOpeningId: openingId, skillId, kind, matchedAlias: name });
    }
  }
  await db.delete(jobOpeningSkills).where(eq(jobOpeningSkills.jobOpeningId, openingId));
  if (rows.length) await db.insert(jobOpeningSkills).values(rows);
}

/**
 * Take exclusive ownership of a source for one sync.
 *
 * Two workers on one source would both page the feed, both decide what is
 * absent, and race each other's status writes — so the lease is the difference
 * between "safe to trigger twice" and "safe to trigger once".
 */
export async function leaseSource(sourceId: string, now: Date, db: Db = getDb()): Promise<{ source: SourceRow; leaseToken: string } | null> {
  const leaseToken = randomUUID();
  const [leased] = await db.update(jobSources)
    .set({ leaseToken, leaseExpiresAt: new Date(now.getTime() + SOURCE_LEASE_MS), lastSyncStartedAt: now, updatedAt: now })
    .where(and(
      eq(jobSources.id, sourceId),
      or(isNull(jobSources.leaseExpiresAt), lte(jobSources.leaseExpiresAt, now)),
    ))
    .returning();
  return leased ? { source: leased, leaseToken } : null;
}

async function releaseSource(db: Db, sourceId: string, leaseToken: string, patch: Partial<typeof jobSources.$inferInsert>) {
  await db.update(jobSources)
    .set({ ...patch, leaseToken: null, leaseExpiresAt: null, updatedAt: new Date() })
    .where(and(eq(jobSources.id, sourceId), eq(jobSources.leaseToken, leaseToken)));
}

export interface SyncOutcome {
  sourceSlug: string;
  runId: string | null;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  totals: SyncTotals;
  cursor: string | null;
  errorCode?: string;
  errorMessage?: string;
  skipped?: string;
}

/**
 * Sync one source: page the feed, upsert what it returned, and grade what it
 * did not.
 *
 * Idempotent in the way that matters operationally: `idempotencyKey` makes a
 * repeated trigger resume the same run row instead of forking a second one, and
 * the per-record upsert is keyed on `(source, externalId)` so running twice
 * produces updates, never duplicates.
 */
export async function syncJobSource(input: {
  sourceId: string;
  triggeredBy: string;
  idempotencyKey?: string;
  now?: Date;
  db?: Db;
  budget?: ExecutionBudget;
  adapters?: Record<string, JobsAdapter>;
  env?: NodeJS.ProcessEnv;
}): Promise<SyncOutcome> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  const budget = input.budget ?? createExecutionBudget(EXECUTION_CONTRACT.drainBudgetMs);

  const leased = await leaseSource(input.sourceId, now, db);
  if (!leased) {
    const [row] = await db.select({ slug: jobSources.slug }).from(jobSources).where(eq(jobSources.id, input.sourceId));
    return { sourceSlug: row?.slug ?? input.sourceId, runId: null, status: "SKIPPED", totals: emptyTotals(), cursor: null, skipped: "another worker holds the lease" };
  }
  const { source, leaseToken } = leased;

  const idempotencyKey = input.idempotencyKey ?? `jobs-sync:${source.slug}:${now.toISOString().slice(0, 13)}`;
  const [run] = await db.insert(jobSyncRuns)
    .values({
      sourceId: source.id, status: "RUNNING", triggeredBy: input.triggeredBy, idempotencyKey,
      cursorBefore: source.cursor, startedAt: now,
    })
    .onConflictDoUpdate({
      target: jobSyncRuns.idempotencyKey,
      set: { status: "RUNNING", startedAt: now, completedAt: null, errorCode: null, errorMessage: null },
    })
    .returning();

  const totals = emptyTotals();
  const seenExternalIds = new Set<string>();
  let cursor = source.cursor ?? null;
  let completed = false;
  let failure: { code: string; message: string } | undefined;

  try {
    assertFeedTransportAllowed(source.config, input.env);
    const adapter = resolveAdapter(source.adapter, input.adapters);
    const credential = resolveCredential(source, input.env);
    const fieldMap = fieldMapSchema.parse((source.config as { fieldMap?: unknown }).fieldMap);
    const skillIndex = await loadSkillIndex(db);
    const maxPages = Number((source.config as { maxPages?: number }).maxPages ?? 20);

    for (let page = 0; page < maxPages; page += 1) {
      // Stop cleanly rather than being killed: the cursor is persisted below,
      // so the next tick continues from exactly here.
      if (!budget.hasRoomFor(EXECUTION_CONTRACT.modelBudgetMs)) break;
      const result = await adapter.fetchPage({
        config: source.config as Record<string, unknown>,
        credential,
        cursor,
        signal: budget.signal(EXECUTION_CONTRACT.extractionBudgetMs),
      });
      totals.pagesFetched += 1;

      for (const record of result.items) {
        totals.itemsSeen += 1;
        const normalized = normalizeOpening(record, fieldMap);
        if (!normalized.ok) {
          // A malformed record is skipped and counted, never guessed at, and
          // never allowed to abort the page: one bad row must not cost a sync.
          totals.itemsInvalid += 1;
          continue;
        }
        const opening = normalized.opening;
        seenExternalIds.add(opening.externalId);
        const [existing] = await db.select({
          id: jobOpenings.id, externalId: jobOpenings.externalId, contentHash: jobOpenings.contentHash,
          status: jobOpenings.status, lastSeenAt: jobOpenings.lastSeenAt, expiresAt: jobOpenings.expiresAt,
        }).from(jobOpenings).where(and(eq(jobOpenings.sourceId, source.id), eq(jobOpenings.externalId, opening.externalId)));

        const decision = planUpsert(opening, existing as ExistingOpening | undefined, now);
        if (decision.action === "touch") {
          totals.itemsUnchanged += 1;
          await db.update(jobOpenings).set({ lastSeenAt: now, updatedAt: now }).where(eq(jobOpenings.id, decision.id));
          continue;
        }
        const values = {
          sourceId: source.id,
          externalId: opening.externalId, canonicalKey: opening.canonicalKey,
          title: opening.title, company: opening.company, location: opening.location,
          workMode: opening.workMode, employmentType: opening.employmentType, description: opening.description,
          requiredSkills: opening.requiredSkills, preferredSkills: opening.preferredSkills,
          applicationUrl: opening.applicationUrl, postedAt: opening.postedAt, expiresAt: opening.expiresAt,
          salaryMin: opening.salaryMin, salaryMax: opening.salaryMax,
          salaryCurrency: opening.salaryCurrency, salaryPeriod: opening.salaryPeriod,
          status: decision.status, contentHash: opening.contentHash,
          lastSeenAt: now, updatedAt: now,
        };
        // The unique constraint is the arbiter, not the read above: two workers
        // that slipped past the lease still cannot create duplicate rows.
        const [written] = await db.insert(jobOpenings)
          .values({ ...values, firstSeenAt: now, statusChangedAt: now })
          .onConflictDoUpdate({
            target: [jobOpenings.sourceId, jobOpenings.externalId],
            set: {
              ...values,
              // `statusChangedAt` only moves when the status actually moved, so
              // "how long has this been stale" stays answerable across syncs.
              // The timestamp is passed as an explicit ISO cast: a bare Date
              // inside a raw fragment has no type for the driver to bind.
              statusChangedAt: sql`case when ${jobOpenings.status} = ${decision.status} then ${jobOpenings.statusChangedAt} else ${now.toISOString()}::timestamptz end`,
            },
          })
          .returning({ id: jobOpenings.id });
        if (decision.action === "create") totals.itemsCreated += 1; else totals.itemsUpdated += 1;
        await writeOpeningSkills(db, written.id, opening, skillIndex);
      }

      cursor = result.nextCursor ?? null;
      if (!cursor) { completed = true; break; }
      if (result.retryAfterMs) await new Promise((resolve) => setTimeout(resolve, Math.min(result.retryAfterMs!, 10_000)));
    }
  } catch (error) {
    if (error instanceof JobsFeedError) failure = { code: error.code, message: error.message };
    else if (isDeadlineError(error)) failure = { code: "SYNC_BUDGET_EXCEEDED", message: "Sync ran out of execution budget." };
    else if (error instanceof ArenaDomainError) failure = { code: error.code, message: error.message };
    else failure = { code: "SYNC_FAILED", message: error instanceof Error ? error.message.slice(0, 300) : "Unknown sync failure." };
  }

  // Absence is only meaningful after a COMPLETE pass. This single condition is
  // what stops a provider outage from marking an entire board as closed.
  if (completed && !failure) {
    const known = await db.select({
      id: jobOpenings.id, externalId: jobOpenings.externalId, contentHash: jobOpenings.contentHash,
      status: jobOpenings.status, lastSeenAt: jobOpenings.lastSeenAt, expiresAt: jobOpenings.expiresAt,
    }).from(jobOpenings).where(and(eq(jobOpenings.sourceId, source.id), ne(jobOpenings.status, "CLOSED")));
    for (const row of known) {
      if (seenExternalIds.has(row.externalId)) continue;
      const next = planAbsence(row as ExistingOpening, { now, stalenessDays: source.stalenessDays, sweptFully: true });
      if (!next) continue;
      await db.update(jobOpenings).set({ status: next, statusChangedAt: now, updatedAt: now }).where(eq(jobOpenings.id, row.id));
      if (next === "CLOSED") totals.itemsClosed += 1;
    }
  }

  const status = classifyRun(totals, { error: Boolean(failure), completed });
  await db.update(jobSyncRuns).set({
    status, completedAt: new Date(), cursorAfter: cursor, ...totals,
    errorCode: failure?.code ?? null, errorMessage: failure?.message.slice(0, 500) ?? null,
  }).where(eq(jobSyncRuns.id, run.id));

  await releaseSource(db, source.id, leaseToken, {
    // A completed pass starts the next sync from the top; a partial one resumes.
    cursor: completed ? null : cursor,
    ...(status === "SUCCESS"
      ? { lastSuccessfulSyncAt: new Date(), consecutiveFailures: 0, lastErrorCode: null, lastErrorMessage: null }
      : { lastFailureAt: new Date(), consecutiveFailures: source.consecutiveFailures + 1, lastErrorCode: failure?.code ?? "SYNC_INCOMPLETE", lastErrorMessage: failure?.message.slice(0, 500) ?? "Sync did not complete a full pass." }),
  });

  await writeAudit(db, {
    actorType: input.triggeredBy.startsWith("admin:") ? "ADMIN" : "AUTOMATION",
    actorSubject: input.triggeredBy,
    action: "JOBS_SYNC",
    entityType: "job_source",
    entityId: source.id,
    // Totals and error codes only. No feed payloads, no credentials, no URLs
    // carrying query tokens.
    metadata: { slug: source.slug, status, ...totals, errorCode: failure?.code ?? null },
  });

  return {
    sourceSlug: source.slug, runId: run.id, status, totals,
    cursor: completed ? null : cursor,
    ...(failure ? { errorCode: failure.code, errorMessage: failure.message } : {}),
  };
}

/** Sync every source that is active and due, inside one execution budget. */
export async function syncDueJobSources(input: {
  triggeredBy: string;
  now?: Date;
  db?: Db;
  budget?: ExecutionBudget;
  adapters?: Record<string, JobsAdapter>;
  env?: NodeJS.ProcessEnv;
} = { triggeredBy: "scheduler" }): Promise<{ synced: SyncOutcome[]; deferred: number }> {
  const now = input.now ?? new Date();
  const db = input.db ?? getDb();
  const budget = input.budget ?? createExecutionBudget(EXECUTION_CONTRACT.drainBudgetMs);
  const sources = await db.select().from(jobSources).where(eq(jobSources.isActive, true)).orderBy(asc(jobSources.slug));
  const due = sources.filter((source) => isSourceDue(source, now));
  const synced: SyncOutcome[] = [];
  let deferred = 0;
  for (const source of due) {
    if (!budget.hasRoomFor(EXECUTION_CONTRACT.extractionBudgetMs)) { deferred += 1; continue; }
    synced.push(await syncJobSource({ ...input, sourceId: source.id, now, db, budget }));
  }
  return { synced, deferred };
}

/** Operational view for the admin console: health, freshness, last error. */
export async function getJobSourceStatus(db: Db = getDb()) {
  const sources = await db.select().from(jobSources).orderBy(asc(jobSources.slug));
  const rows = [];
  for (const source of sources) {
    const [lastRun] = await db.select().from(jobSyncRuns)
      .where(eq(jobSyncRuns.sourceId, source.id)).orderBy(desc(jobSyncRuns.startedAt)).limit(1);
    const counts = await db.select({ status: jobOpenings.status, count: sql<number>`count(*)::int` })
      .from(jobOpenings).where(eq(jobOpenings.sourceId, source.id)).groupBy(jobOpenings.status);
    // Config is non-secret by contract (credentials live in the environment),
    // so the addresses and label can be shown; nothing else from it is.
    const config = (source.config ?? {}) as { baseUrl?: unknown; siteUrl?: unknown; category?: unknown };
    rows.push({
      id: source.id, slug: source.slug, name: source.name, adapter: source.adapter,
      feedUrl: typeof config.baseUrl === "string" ? config.baseUrl : null,
      siteUrl: typeof config.siteUrl === "string" ? config.siteUrl : null,
      category: typeof config.category === "string" ? config.category : null,
      isActive: source.isActive, syncIntervalMinutes: source.syncIntervalMinutes,
      stalenessDays: source.stalenessDays,
      // The NAME of the variable, so an operator can see what to provision. The
      // value is never read here and never returned.
      credentialEnvVar: source.credentialEnvVar,
      credentialConfigured: source.credentialEnvVar ? Boolean(process.env[source.credentialEnvVar]) : null,
      lastSuccessfulSyncAt: source.lastSuccessfulSyncAt, lastFailureAt: source.lastFailureAt,
      consecutiveFailures: source.consecutiveFailures,
      lastErrorCode: source.lastErrorCode, lastErrorMessage: source.lastErrorMessage,
      leaseHeld: Boolean(source.leaseExpiresAt && source.leaseExpiresAt > new Date()),
      openings: Object.fromEntries(counts.map((row) => [row.status, row.count])),
      lastRun: lastRun
        ? { id: lastRun.id, status: lastRun.status, startedAt: lastRun.startedAt, completedAt: lastRun.completedAt,
            triggeredBy: lastRun.triggeredBy, itemsSeen: lastRun.itemsSeen, itemsCreated: lastRun.itemsCreated,
            itemsUpdated: lastRun.itemsUpdated, itemsInvalid: lastRun.itemsInvalid, itemsClosed: lastRun.itemsClosed,
            errorCode: lastRun.errorCode }
        : null,
    });
  }
  return rows;
}

/** Disable a source without deleting its history. */
export async function setJobSourceActive(input: { sourceId: string; isActive: boolean; actorSubject: string; db?: Db }) {
  const db = input.db ?? getDb();
  const [updated] = await db.update(jobSources)
    .set({ isActive: input.isActive, updatedAt: new Date() })
    .where(eq(jobSources.id, input.sourceId))
    .returning({ id: jobSources.id, slug: jobSources.slug, isActive: jobSources.isActive });
  if (!updated) throw new ArenaDomainError("VALIDATION_ERROR", "Job source not found.");
  // Openings are not touched: disabling a source stops new data arriving, it
  // does not retroactively claim every role it ever listed has closed.
  await writeAudit(db, {
    actorType: "ADMIN", actorSubject: input.actorSubject,
    action: input.isActive ? "JOBS_SOURCE_ENABLED" : "JOBS_SOURCE_DISABLED",
    entityType: "job_source", entityId: updated.id, metadata: { slug: updated.slug },
  });
  return updated;
}

/** Openings a disabled source left behind stop being recommended. */
export async function hideOpeningsForInactiveSources(db: Db = getDb(), now = new Date()) {
  const inactive = await db.select({ id: jobSources.id }).from(jobSources).where(eq(jobSources.isActive, false));
  if (!inactive.length) return 0;
  const updated = await db.update(jobOpenings)
    .set({ status: "STALE", statusChangedAt: now, updatedAt: now })
    .where(and(inArray(jobOpenings.sourceId, inactive.map((row) => row.id)), eq(jobOpenings.status, "OPEN")))
    .returning({ id: jobOpenings.id });
  return updated.length;
}
