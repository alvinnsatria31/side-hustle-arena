import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { rateLimitCounters } from "@/server/db/schema";

/**
 * The spend limiter for the unauthenticated CV scan endpoint.
 *
 * Every call costs money, and the endpoint needs no session, so the only thing
 * standing between a script and the AI bill is this. It used to be a `Map` in
 * one serverless instance: it reset on cold start and never saw the other
 * instances, which meant the real ceiling was "5 per instance per hour" — an
 * unknown multiple of the intended 5. The counter now lives in Postgres, where
 * every instance shares it.
 *
 * Fixed window, one atomic upsert. See `ops.rate_limit_counters` for why that
 * beats a sliding window here.
 *
 * On a database error the in-memory limiter below takes over. Failing closed
 * would take the feature down for everyone over a transient blip; failing fully
 * open would remove the bill's only guard. The fallback is the old behaviour —
 * weaker, but never weaker than what shipped before.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const BUCKET = "cv-scan";
/**
 * The whole endpoint's hourly ceiling, across every caller.
 *
 * The per-IP limit caps one script; it does nothing about a thousand of them,
 * and a per-caller limiter is not a spend cap however low you set it. This is
 * the number that actually bounds the bill, and it is deliberately generous
 * enough to be invisible in normal use and hard enough to stop an incident.
 * Configurable so an operator can lower it during one without a deploy.
 */
const GLOBAL_SUBJECT = "__global__";
const DEFAULT_MAX_PER_WINDOW_GLOBAL = 300;

function globalCeiling(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.CV_SCAN_HOURLY_CAP ?? "");
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_PER_WINDOW_GLOBAL;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  /** Where the decision came from, so the route can log a degraded limiter. */
  degraded: boolean;
  /** Which ceiling refused: the caller's own, or the endpoint's total spend. */
  scope?: "caller" | "global";
}

/** Best-effort client identity. Vercel sets x-forwarded-for; nothing else is trusted. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

/** The window a moment belongs to, so every instance agrees on the boundary. */
function windowStartFor(now: number): Date {
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
}

function retryAfterFor(windowStart: Date, now: number): number {
  return Math.max(1, Math.ceil((windowStart.getTime() + WINDOW_MS - now) / 1000));
}

// ---------------------------------------------------------------------------
// Fallback: the previous process-local limiter, used only when the DB is down.
// ---------------------------------------------------------------------------

const hits = new Map<string, number[]>();

function checkInMemory(key: string, now: number): RateLimitDecision {
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);
  if (recent.length >= MAX_PER_WINDOW) {
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
 * Count this request against the caller's allowance.
 *
 * The upsert both records the attempt and reports the running total, so two
 * instances racing on the same key cannot both read "4" and both allow a fifth.
 */
export async function checkRateLimit(key: string, now = Date.now(), db?: Db, env: NodeJS.ProcessEnv = process.env): Promise<RateLimitDecision> {
  const windowStart = windowStartFor(now);
  const client = db ?? getDb();
  const bump = async (subject: string) => {
    const [row] = await client
      .insert(rateLimitCounters)
      .values({ bucket: BUCKET, subject, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimitCounters.bucket, rateLimitCounters.subject, rateLimitCounters.windowStart],
        set: { count: sql`${rateLimitCounters.count} + 1` },
      })
      .returning({ count: rateLimitCounters.count });
    return row.count;
  };
  try {
    // The caller's own allowance first: a caller who is already over their
    // limit must not also consume a slot from the endpoint's total budget.
    const callerCount = await bump(key);
    if (callerCount > MAX_PER_WINDOW) {
      return { allowed: false, retryAfterSeconds: retryAfterFor(windowStart, now), degraded: false, scope: "caller" };
    }
    const totalCount = await bump(GLOBAL_SUBJECT);
    if (totalCount > globalCeiling(env)) {
      return { allowed: false, retryAfterSeconds: retryAfterFor(windowStart, now), degraded: false, scope: "global" };
    }
    return { allowed: true, retryAfterSeconds: 0, degraded: false };
  } catch {
    // Deliberately no rethrow: a limiter that takes the endpoint down with it
    // has turned a cost control into an outage.
    //
    // Nothing durable can be recorded here — the durable store is precisely
    // what is unreachable — so the degraded flag travels back to the caller and
    // the route logs it. That is the honest limit of what this path can offer.
    return checkInMemory(key, now);
  }
}

/**
 * How much of the endpoint's hourly budget is spent, for the admin readiness
 * view. Read-only: asking must never consume an allowance.
 */
export async function getSpendWindow(now = Date.now(), db?: Db, env: NodeJS.ProcessEnv = process.env) {
  const windowStart = windowStartFor(now);
  const ceiling = globalCeiling(env);
  try {
    const [row] = await (db ?? getDb())
      .select({ count: rateLimitCounters.count })
      .from(rateLimitCounters)
      .where(and(
        eq(rateLimitCounters.bucket, BUCKET),
        eq(rateLimitCounters.subject, GLOBAL_SUBJECT),
        eq(rateLimitCounters.windowStart, windowStart),
      ));
    return { used: row?.count ?? 0, ceiling, windowStart, available: true as const };
  } catch {
    // An unreadable counter is reported as unknown, never as zero: "no scans
    // this hour" and "we cannot see the counter" are opposite operational facts.
    return { used: null, ceiling, windowStart, available: false as const };
  }
}

/**
 * Drop windows that can no longer refuse anything. Called by `session-cleanup`
 * rather than opportunistically on the request path, so a scan never pays for
 * someone else's housekeeping.
 */
export async function pruneRateLimitCounters(now = new Date(), db?: Db): Promise<number> {
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  const deleted = await (db ?? getDb())
    .delete(rateLimitCounters)
    .where(lt(rateLimitCounters.windowStart, cutoff))
    .returning({ subject: rateLimitCounters.subject });
  return deleted.length;
}

/** Test seam for the in-memory fallback, which is process-global by design. */
export function resetRateLimit(): void {
  hits.clear();
}

export const rateLimitConfigForTests = { WINDOW_MS, MAX_PER_WINDOW, BUCKET, GLOBAL_SUBJECT, DEFAULT_MAX_PER_WINDOW_GLOBAL, globalCeiling };
