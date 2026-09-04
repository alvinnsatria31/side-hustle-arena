import "server-only";
import { getDb } from "@/server/db/client";
import { featureFlags } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import {
  ARENA_FEATURE_OPEN,
  resolveArenaFeatureState,
  type ArenaFeatureKey,
} from "./feature-flags-core";

export type { ArenaFeatureKey } from "./feature-flags-core";
export {
  ARENA_FEATURES,
  arenaFeatureKeys,
  featureLabel,
  resolveArenaFeatureState,
  type ArenaFeatureDefinition,
  type ArenaFeatureState,
} from "./feature-flags-core";

/**
 * Arena maintenance switches — logic transferred from sekolah-karir-website
 * (`src/lib/feature-flags.ts`), re-keyed for Arena operations (PRD §37, §49).
 *
 * The flag lives in the database (not an env var) precisely because an env
 * var needs a redeploy to flip back — the worst property a switch can have
 * when you reach for it while something is already going wrong.
 */

type Db = ReturnType<typeof getDb>;

/** Missing row, missing table, dead database → open. Never throws. */
export async function getArenaFeatureState(
  key: ArenaFeatureKey,
  db: Db = getDb(),
) {
  try {
    const rows = await db.select().from(featureFlags);
    return resolveArenaFeatureState(rows, key);
  } catch (error) {
    // Open, loudly: a database blip must never silently close the Arena.
    console.error("Failed to read arena feature flags:", error);
    return ARENA_FEATURE_OPEN;
  }
}

/**
 * Refuses a participant-facing write while its feature is closed.
 * Admin exemption is injected by the caller — Arena admin authorization is
 * still DEFERRED (see AUTH_IMPLEMENTATION.md), so the default is non-admin.
 */
export async function assertArenaFeatureOpen(
  key: ArenaFeatureKey,
  options: { db?: Db; isAdmin?: boolean } = {},
): Promise<void> {
  const state = await getArenaFeatureState(key, options.db ?? getDb());
  if (!state.closed) return;
  if (options.isAdmin) return;
  throw new ArenaDomainError(
    "FEATURE_CLOSED",
    state.message ?? "Fitur ini sedang ditutup sementara untuk perbaikan. Coba lagi nanti ya.",
    { feature: key },
  );
}
