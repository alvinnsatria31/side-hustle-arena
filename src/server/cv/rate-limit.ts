import "server-only";

/**
 * A speed bump for the unauthenticated CV scan endpoint, which spends money on
 * every call.
 *
 * Deliberately modest and honestly labelled: the counter lives in the memory of
 * one serverless instance, so it resets on cold start and does not coordinate
 * across concurrent instances. It stops a casual loop, not a determined one.
 * Real protection needs shared state (the Arena database, or a KV store) and is
 * tracked as a follow-up — see docs/backend/END_TO_END_IMPLEMENTATION.md.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const hits = new Map<string, number[]>();

/** Best-effort client identity. Vercel sets x-forwarded-for; nothing else is trusted. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);
  if (recent.length >= MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
    hits.set(key, recent);
    return { allowed: false, retryAfterSeconds };
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) {
    for (const [entry, times] of hits) {
      if (!times.some((at) => at > cutoff)) hits.delete(entry);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test seam: the limiter is process-global by design. */
export function resetRateLimit(): void {
  hits.clear();
}
