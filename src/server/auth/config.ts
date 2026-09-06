import "server-only";
import { parseArenaAuthConfig, parseArenaMutationOrigins, parseArenaSsoBridgeConfig } from "./config-core";

export type { ArenaAuthConfig, ArenaSsoBridgeConfig } from "./config-core";

/**
 * The main site's sign-in gate lives on `www`; the apex 308-redirects to it.
 * Defaulting to the host that actually serves `/arena` keeps the login button
 * working when `SK_AUTH_ORIGIN` is missing and saves a redirect hop when it is
 * merely set to the apex.
 */
const DEFAULT_CANONICAL_ORIGIN = "https://www.sekolahkarir.id";

function arenaOrigin(): string {
  return process.env.ARENA_ORIGIN ?? "https://arena.sekolahkarir.id";
}

function canonicalOrigin(): string {
  return process.env.SK_AUTH_ORIGIN?.trim() || DEFAULT_CANONICAL_ORIGIN;
}

/** Where this app lives and where the gate is — all signing in and out needs. */
export function getAuthConfig() {
  return parseArenaAuthConfig({ arenaOrigin: arenaOrigin(), canonicalOrigin: canonicalOrigin() });
}

/** Origins permitted to drive a state-changing request. */
export function getArenaMutationOrigins(): string[] {
  const origin = arenaOrigin();
  return parseArenaMutationOrigins({
    arenaOrigin: origin,
    canonicalOrigin: canonicalOrigin(),
    allowedOrigins: (process.env.ARENA_ALLOWED_ORIGINS ?? origin)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  });
}

/** Dormant PKCE bridge credentials; see docs/backend/AUTH_INTEGRATION_CONTRACT.md. */
export function getSsoBridgeConfig() {
  return parseArenaSsoBridgeConfig({
    arenaOrigin: arenaOrigin(),
    canonicalOrigin: canonicalOrigin(),
    clientId: process.env.ARENA_SSO_CLIENT_ID,
    clientSecret: process.env.ARENA_SSO_CLIENT_SECRET,
    introspectionIntervalSeconds: process.env.ARENA_SSO_INTROSPECTION_INTERVAL_SECONDS,
  });
}

export function getArenaCallbackUri(): string {
  return new URL("/auth/callback", arenaOrigin()).toString();
}
