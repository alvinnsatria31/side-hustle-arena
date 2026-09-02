import "server-only";
import { parseArenaAuthConfig } from "./config-core";

export function getAuthConfig() {
  const arenaOrigin = process.env.ARENA_ORIGIN ?? "https://arena.sekolahkarir.id";
  return parseArenaAuthConfig({
    arenaOrigin,
    canonicalOrigin: process.env.SK_AUTH_ORIGIN,
    clientId: process.env.ARENA_SSO_CLIENT_ID,
    clientSecret: process.env.ARENA_SSO_CLIENT_SECRET,
    introspectionIntervalSeconds: process.env.ARENA_SSO_INTROSPECTION_INTERVAL_SECONDS,
    allowedOrigins: (process.env.ARENA_ALLOWED_ORIGINS ?? arenaOrigin)
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  });
}

export function getArenaCallbackUri(): string {
  return new URL("/auth/callback", getAuthConfig().arenaOrigin).toString();
}
