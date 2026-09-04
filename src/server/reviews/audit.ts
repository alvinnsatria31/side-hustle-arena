import "server-only";
import { getDb } from "@/server/db/client";
import { logs } from "@/server/db/schema";

/**
 * Automation + review audit writer (PRD §31, §45).
 *
 * Every automation action is recorded: review claimed/failed/retried/
 * completed, second-judge disagreement, rerun, override. Rows are
 * append-only — nothing here updates or deletes history.
 */

type Db = ReturnType<typeof getDb>;

export async function writeAudit(
  db: Db,
  entry: {
    actorType: "USER" | "ADMIN" | "AUTOMATION" | "SYSTEM";
    actorSubject?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  await db.insert(logs).values({
    actorType: entry.actorType,
    actorSubject: entry.actorSubject ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  });
}
