import "server-only";
import { z } from "zod";

const configSchema = z.object({
  arenaOrigin: z.string().url(),
  canonicalOrigin: z.string().url(),
  clientId: z.literal("arena"),
  clientSecret: z.string().min(32),
  introspectionIntervalSeconds: z.coerce.number().int().min(60).max(3_600).default(300),
  allowedOrigins: z.array(z.string().url()).min(1),
});

export function getAuthConfig() {
  const arenaOrigin = process.env.ARENA_ORIGIN ?? "https://arena.sekolahkarir.id";
  const result = configSchema.safeParse({
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
  if (!result.success) throw new Error("Arena auth configuration is invalid.");
  return result.data;
}

export function getArenaCallbackUri(): string {
  return new URL("/auth/callback", getAuthConfig().arenaOrigin).toString();
}
