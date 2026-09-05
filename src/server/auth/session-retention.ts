import "server-only";
import { and, isNotNull, lt, or } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { ARENA_SESSION_RETENTION_MS } from "./retention";

/**
 * Explicit maintenance operation for the scheduler; never invoked by an auth
 * request. Kept out of `session.ts` because that module reaches for
 * `next/headers`, which only exists inside a request — this one has to run from
 * a cron job and from offline test suites.
 */
export async function cleanupExpiredArenaSessions(now = new Date()) {
  const cutoff = new Date(now.getTime() - ARENA_SESSION_RETENTION_MS);
  const deleted = await getDb()
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, cutoff), and(isNotNull(sessions.revokedAt), lt(sessions.revokedAt, cutoff))))
    .returning({ id: sessions.id });
  return deleted.length;
}
