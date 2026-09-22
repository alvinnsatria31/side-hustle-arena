import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { rateLimitCounters } from "@/server/db/schema";

/**
 * The volume guard for submission uploads.
 *
 * One submission holds at most 5 files (MAX_FILES in service.ts), so 20
 * presigns an hour leaves generous headroom for abandoned intents and retries
 * while a script minting intents in a loop hits the wall fast; 5 finalizes an
 * hour is one full submission, because each finalize downloads the object and
 * checks its magic bytes — the most expensive step in this flow. Per user, not
 * per IP: these routes require a session, so the stable identity is the user
 * id.
 *
 * Same store and same fixed-window atomic upsert as the CV scanner's limiter
 * (`src/server/cv/rate-limit.ts`): `rate_limit_counters` was built for exactly
 * this reuse — one row per (bucket, subject, window_start) — and the
 * `session-cleanup` job already prunes it via `pruneRateLimitCounters`, so no
 * new housekeeping is needed. Separate buckets keep the two allowances
 * independent of each other and of the CV scanner's.
 *
 * On a database error the process-local limiter below takes over, for the same
 * reason as the CV one: a limiter that takes uploads down with it turns a
 * volume guard into an outage, and the file caps (count, size, type, magic
 * bytes) still hold while degraded.
 */

const WINDOW_MS = 60 * 60 * 1000;
const PRESIGN_BUCKET = "upload-presign";
const FINALIZE_BUCKET = "upload-finalize";
/** A full file set per hour, with headroom for retries and abandoned intents. */
export const UPLOAD_PRESIGN_MAX_PER_WINDOW = 20;
/** One full submission's worth of finalize work per hour. */
export const UPLOAD_FINALIZE_MAX_PER_WINDOW = 5;

export type UploadRateLimitKind = "presign" | "finalize";

export interface UploadRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  /** Where the decision came from, so the service can log a degraded limiter. */
  degraded: boolean;
}

/** Stable per-user subject. A user id, never a user secret. */
export function uploadRateLimitSubject(userId: string): string {
  return `user:${userId}`;
}

function bucketFor(kind: UploadRateLimitKind): string {
  return kind === "presign" ? PRESIGN_BUCKET : FINALIZE_BUCKET;
}

function maxFor(kind: UploadRateLimitKind): number {
  return kind === "presign" ? UPLOAD_PRESIGN_MAX_PER_WINDOW : UPLOAD_FINALIZE_MAX_PER_WINDOW;
}

/** The window a moment belongs to, so every instance agrees on the boundary. */
function windowStartFor(now: number): Date {
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
}

function retryAfterFor(windowStart: Date, now: number): number {
  return Math.max(1, Math.ceil((windowStart.getTime() + WINDOW_MS - now) / 1000));
}

// ---------------------------------------------------------------------------
// Fallback: a process-local limiter per bucket, used only when the DB is down.
// ---------------------------------------------------------------------------

const hits = new Map<string, number[]>();

function checkInMemory(bucket: string, subject: string, max: number, now: number): UploadRateLimitDecision {
  const key = `${bucket}|${subject}`;
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000)), degraded: true };
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) {
    for (const [entry, times] of hits) {
      if (!times.some((at) => at > cutoff)) hits.delete(entry);
    }
  }
  return { allowed: true, retryAfterSeconds: 0, degraded: true };
}

// ---------------------------------------------------------------------------

type Db = ReturnType<typeof getDb>;

/**
 * Count this upload attempt against the user's hourly allowance.
 *
 * The upsert both records the attempt and reports the running total, so two
 * instances racing on the same user cannot both read "19" and both allow a
 * twentieth presign.
 */
export async function checkUploadRateLimit(kind: UploadRateLimitKind, subject: string, now = Date.now(), db?: Db): Promise<UploadRateLimitDecision> {
  const bucket = bucketFor(kind);
  const max = maxFor(kind);
  const windowStart = windowStartFor(now);
  const client = db ?? getDb();
  try {
    const [row] = await client
      .insert(rateLimitCounters)
      .values({ bucket, subject, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimitCounters.bucket, rateLimitCounters.subject, rateLimitCounters.windowStart],
        set: { count: sql`${rateLimitCounters.count} + 1` },
      })
      .returning({ count: rateLimitCounters.count });
    if (row.count > max) {
      return { allowed: false, retryAfterSeconds: retryAfterFor(windowStart, now), degraded: false };
    }
    return { allowed: true, retryAfterSeconds: 0, degraded: false };
  } catch {
    // Deliberately no rethrow: a limiter that takes uploads down with it has
    // turned a volume guard into an outage. Same contract as the CV limiter.
    return checkInMemory(bucket, subject, max, now);
  }
}

/** Test seam for the in-memory fallback, which is process-global by design. */
export function resetUploadRateLimit(): void {
  hits.clear();
}

export const uploadRateLimitConfigForTests = {
  WINDOW_MS,
  PRESIGN_BUCKET,
  FINALIZE_BUCKET,
  UPLOAD_PRESIGN_MAX_PER_WINDOW,
  UPLOAD_FINALIZE_MAX_PER_WINDOW,
  windowStartFor,
  retryAfterFor,
};
