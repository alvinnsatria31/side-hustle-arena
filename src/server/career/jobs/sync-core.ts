import type { NormalizedOpening } from "./normalize";

/**
 * What a sync should DO, decided without a database in the room.
 *
 * Every rule here is about not lying to a participant. An opening we stopped
 * seeing might have been filled, or the provider's third page might have 500'd;
 * those are different facts and only one of them means the job is gone. So
 * absence is graded rather than acted on immediately, and nothing is ever
 * deleted — a closed row still explains why a recommendation existed last week.
 */

export type OpeningStatus = "OPEN" | "EXPIRED" | "STALE" | "CLOSED";

export interface ExistingOpening {
  id: string;
  externalId: string;
  contentHash: string;
  status: OpeningStatus;
  lastSeenAt: Date;
  expiresAt: Date | null;
}

export type UpsertDecision =
  | { action: "create"; opening: NormalizedOpening; status: OpeningStatus }
  | { action: "update"; id: string; opening: NormalizedOpening; status: OpeningStatus }
  | { action: "touch"; id: string; status: OpeningStatus };

/**
 * Status of a record we just saw in the feed.
 *
 * Seeing it always revives it: a provider that re-lists a role has told us more
 * than our staleness timer inferred, so a previously CLOSED row goes back to
 * OPEN rather than staying closed on the strength of an old guess.
 */
export function statusForSeen(opening: Pick<NormalizedOpening, "expiresAt">, now: Date): OpeningStatus {
  if (opening.expiresAt && opening.expiresAt <= now) return "EXPIRED";
  return "OPEN";
}

/**
 * Compare one feed record against what we already hold.
 *
 * `touch` — same content, only `lastSeenAt` moves. This is the overwhelmingly
 * common case on a re-sync and the reason a repeated trigger is cheap as well
 * as safe.
 */
export function planUpsert(
  opening: NormalizedOpening,
  existing: ExistingOpening | undefined,
  now: Date,
): UpsertDecision {
  const status = statusForSeen(opening, now);
  if (!existing) return { action: "create", opening, status };
  if (existing.contentHash === opening.contentHash && existing.status === status) {
    return { action: "touch", id: existing.id, status };
  }
  return { action: "update", id: existing.id, opening, status };
}

/**
 * What to do about an opening the latest sync did NOT see.
 *
 * Only decided when the sync actually completed a full pass: a partial sync has
 * no opinion about absence, because it did not finish looking. That single
 * condition is what stops a provider outage from closing an entire board.
 */
export function planAbsence(
  existing: ExistingOpening,
  options: { now: Date; stalenessDays: number; sweptFully: boolean },
): OpeningStatus | null {
  if (!options.sweptFully) return null;
  if (existing.status === "CLOSED") return null;
  if (existing.expiresAt && existing.expiresAt <= options.now && existing.status !== "EXPIRED") return "EXPIRED";
  const unseenMs = options.now.getTime() - existing.lastSeenAt.getTime();
  const staleMs = options.stalenessDays * 86_400_000;
  // Two-step on purpose: STALE is a visible warning state for an operator,
  // CLOSED is the conclusion. Jumping straight to CLOSED hides the moment a
  // feed started dropping rows it should not have.
  if (unseenMs >= staleMs * 2) return "CLOSED";
  if (unseenMs >= staleMs && existing.status !== "STALE") return "STALE";
  return null;
}

/** Only OPEN roles are recommendable. Everything else is history. */
export function isRecommendable(status: OpeningStatus): boolean {
  return status === "OPEN";
}

export interface SyncTotals {
  pagesFetched: number;
  itemsSeen: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  itemsInvalid: number;
  itemsClosed: number;
}

export function emptyTotals(): SyncTotals {
  return { pagesFetched: 0, itemsSeen: 0, itemsCreated: 0, itemsUpdated: 0, itemsUnchanged: 0, itemsInvalid: 0, itemsClosed: 0 };
}

/**
 * Did this run finish, half-finish, or fail?
 *
 * A run that fetched nothing and errored is FAILED. A run that got some pages
 * and then stopped is PARTIAL — recorded as such rather than as success,
 * because PARTIAL is precisely the state in which absence must not be trusted.
 */
export function classifyRun(totals: SyncTotals, options: { error: boolean; completed: boolean }): "SUCCESS" | "PARTIAL" | "FAILED" {
  if (options.error && totals.pagesFetched === 0) return "FAILED";
  if (options.error || !options.completed) return "PARTIAL";
  return "SUCCESS";
}

/**
 * Is this source due for a sync?
 *
 * Failures back off exponentially so a broken provider is retried
 * ever-less-often instead of being hammered every tick, capped so a source
 * that recovers is picked up again within a day.
 */
export function isSourceDue(
  source: { isActive: boolean; syncIntervalMinutes: number; lastSyncStartedAt: Date | null; consecutiveFailures: number },
  now: Date,
): boolean {
  if (!source.isActive) return false;
  if (!source.lastSyncStartedAt) return true;
  const backoff = Math.min(2 ** Math.min(source.consecutiveFailures, 6), 24 * 60 / Math.max(1, source.syncIntervalMinutes) || 1);
  const waitMs = source.syncIntervalMinutes * 60_000 * Math.max(1, backoff);
  return now.getTime() - source.lastSyncStartedAt.getTime() >= Math.min(waitMs, 24 * 3600_000);
}

export type SourceHealth = "NEVER_SYNCED" | "HEALTHY" | "DEGRADED" | "FAILING" | "DISABLED";

/**
 * One word an operator can act on.
 *
 * DEGRADED means "it works, but the data on screen is older than the source
 * promised" — the state that matters most, because the page still looks fine.
 */
export function sourceHealth(
  source: {
    isActive: boolean; syncIntervalMinutes: number; consecutiveFailures: number;
    lastSuccessfulSyncAt: Date | null;
  },
  now: Date,
): SourceHealth {
  if (!source.isActive) return "DISABLED";
  if (source.consecutiveFailures >= 3) return "FAILING";
  if (!source.lastSuccessfulSyncAt) return "NEVER_SYNCED";
  const ageMs = now.getTime() - source.lastSuccessfulSyncAt.getTime();
  return ageMs > source.syncIntervalMinutes * 60_000 * 3 ? "DEGRADED" : "HEALTHY";
}

/** How old the data on screen is, in whole minutes. */
export function freshnessMinutes(lastSuccessfulSyncAt: Date | null, now: Date): number | null {
  if (!lastSuccessfulSyncAt) return null;
  return Math.max(0, Math.floor((now.getTime() - lastSuccessfulSyncAt.getTime()) / 60_000));
}
