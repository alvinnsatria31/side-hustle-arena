import "server-only";
import { and, desc, eq, ilike, lt, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { logs } from "@/server/db/schema";

type Db = ReturnType<typeof getDb>;

/**
 * Read the audit trail back.
 *
 * Every admin action in this console writes to `audit.logs` — week creation,
 * project approval, reward reversal, a manually-run job, an off-schedule
 * release — but until now nothing read it back, so "it's all audited" was a
 * claim no operator could check. This is the read side, filterable by the
 * dimensions someone actually investigates along: who, what kind of action,
 * and which entity.
 *
 * `logs` is append-only and this module only ever selects from it. There is no
 * mutation here by design — an audit trail an admin can edit is not one.
 */
export const auditQuery = z.object({
  q: z.string().trim().max(200).default(""),
  actorType: z.enum(["USER", "ADMIN", "AUTOMATION", "SYSTEM"]).optional(),
  entityType: z.string().trim().max(64).optional(),
  /** Keyset pagination: the createdAt of the last row already shown. */
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AuditQuery = z.infer<typeof auditQuery>;

export async function listAuditLog(query: AuditQuery, db: Db = getDb()) {
  const search = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db
    .select({
      id: logs.id,
      createdAt: logs.createdAt,
      actorType: logs.actorType,
      actorSubject: logs.actorSubject,
      action: logs.action,
      entityType: logs.entityType,
      entityId: logs.entityId,
      metadata: logs.metadata,
    })
    .from(logs)
    .where(
      and(
        query.actorType ? eq(logs.actorType, query.actorType) : undefined,
        query.entityType ? eq(logs.entityType, query.entityType) : undefined,
        // Keyset rather than OFFSET: the trail only grows, and OFFSET drifts as
        // new rows land between page loads.
        query.before ? lt(logs.createdAt, new Date(query.before)) : undefined,
        query.q
          ? or(ilike(logs.action, search), ilike(logs.actorSubject, search), ilike(logs.entityId, search))
          : undefined,
      ),
    )
    // id breaks ties within the same instant so keyset paging never repeats or
    // skips a row.
    .orderBy(desc(logs.createdAt), desc(logs.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    entries: page,
    nextBefore: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
  };
}

/** The distinct entity types present, so the filter offers real values not a guess. */
export async function auditEntityTypes(db: Db = getDb()): Promise<string[]> {
  const rows = await db.selectDistinct({ entityType: logs.entityType }).from(logs).orderBy(logs.entityType);
  return rows.map((row) => row.entityType);
}
