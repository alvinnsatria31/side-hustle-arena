import "server-only";
import { desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  ARENA_FEATURES,
  arenaFeatureKeys,
  getArenaFeatureState,
  type ArenaFeatureKey,
} from "@/server/ops/feature-flags";
import { featureFlags } from "@/server/db/schema";
import { catalog, logs, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { resolveCurrentWeekFromCandidates } from "@/server/arena/week-service";
import { writeAudit } from "@/server/reviews/audit";
import { getReviewQueueDepth } from "@/server/reviews/queue-service";
import { getAutomationHealth } from "@/server/ops/automation-health";

type Db = ReturnType<typeof getDb>;

const MONITORED_WEEK_STATUSES = ["OPEN", "SCHEDULED", "PREVIEW", "CLOSED", "FINALIZING", "FINALIZED"] as const;

// The participant resolver, so a draft for next week cannot displace the running week; newest opening is only a fallback.
async function monitoredWeek(db: Db, now: Date) {
  const rows = await db.select().from(weeks).where(inArray(weeks.status, MONITORED_WEEK_STATUSES));
  const current = resolveCurrentWeekFromCandidates(rows, now);
  if (current) return rows.find((row) => row.id === current.id) ?? null;
  const [latest] = await db.select().from(weeks).orderBy(desc(weeks.opensAt)).limit(1);
  return latest ?? null;
}

/**
 * Admin operations overview (PRD §37). Read-only aggregator for the future
 * admin dashboard: week state, queue health, resolution backlog, flags,
 * rewards, and recent audit — one call instead of six.
 */
export async function getOpsOverview(db: Db = getDb(), now = new Date()) {
  const week = await monitoredWeek(db, now);
  const [enrollmentCount, versionCount, resolutionRows, catalogRows, redemptionRows, auditRows, queueDepth] = await Promise.all([
    week ? db.execute(sql`select count(*)::int as n from arena.enrollments where week_id = ${week.id}`) : [{ n: 0 }],
    week
      ? db.execute(sql`
        select count(*)::int as n from arena.submission_versions v
        join arena.submissions s on s.id = v.submission_id where s.week_id = ${week.id}`)
      : [{ n: 0 }],
    week
      ? db.execute(sql`
        select v.id as version_id from arena.reviews r
        join arena.submission_versions v on v.id = r.submission_version_id
        join arena.submissions s on s.id = v.submission_id
        where s.week_id = ${week.id} and r.status = 'NEEDS_RESOLUTION' limit 50`)
      : [],
    db.select({ slug: catalog.slug, isActive: catalog.isActive }).from(catalog),
    db.execute(sql`select status, count(*)::int as n from rewards.redemptions group by status`),
    db.select({ action: logs.action, entityType: logs.entityType, actorType: logs.actorType, actorSubject: logs.actorSubject, entityId: logs.entityId, createdAt: logs.createdAt })
      .from(logs).orderBy(desc(logs.createdAt)).limit(20),
    getReviewQueueDepth(db),
  ]);
  const flags = await Promise.all(
    ARENA_FEATURES.map(async (feature) => ({ ...feature, state: await getArenaFeatureState(feature.key, db) })),
  );
  // Depth answers "how much is queued"; health answers "is anything wrong".
  // A queue of zero is fine when everything drained and alarming when nothing
  // has run for a day, and only one of those is visible from a count.
  const health = await getAutomationHealth(db);
  const first = (rows: unknown) => (rows as Array<{ n: number }>)[0]?.n ?? 0;
  return {
    week: week ? { id: week.id, weekCode: week.weekCode, status: week.status, deadlineAt: week.submissionDeadlineAt } : null,
    enrollments: first(enrollmentCount),
    versions: first(versionCount),
    queue: queueDepth,
    needsResolution: ((resolutionRows as unknown) as Array<{ version_id: string }>).map((row) => row.version_id),
    flags,
    catalog: {
      active: catalogRows.filter((row) => row.isActive).length,
      total: catalogRows.length,
    },
    redemptions: ((redemptionRows as unknown) as Array<{ status: string; n: number }>).map((row) => ({ status: row.status, count: row.n })),
    health,
    recentAudit: auditRows,
  };
}

/** Flip a maintenance switch. Audited; unknown keys rejected. */
export async function setArenaFeatureFlag(input: {
  key: string;
  closed: boolean;
  message?: string | null;
  actorSubject: string;
  db?: Db;
}): Promise<{ key: ArenaFeatureKey; closed: boolean }> {
  const db = input.db ?? getDb();
  if (!(arenaFeatureKeys as readonly string[]).includes(input.key)) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Unknown feature flag.");
  }
  if (!input.actorSubject.trim()) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Flag changes require an actor.");
  }
  const key = input.key as ArenaFeatureKey;
  return db.transaction(async (tx) => {
  await tx
    .insert(featureFlags)
    .values({ key, maintenanceMode: input.closed, message: input.message ?? null })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { maintenanceMode: input.closed, message: input.message ?? null, updatedAt: new Date() },
    });
  await writeAudit(tx, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "FEATURE_FLAG_SET",
    entityType: "feature_flag",
    entityId: key,
    metadata: { closed: input.closed, message: input.message ?? null },
  });
  return { key, closed: input.closed };
  });
}
