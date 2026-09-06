import { z } from "zod";

/**
 * Arena auth configuration, split by concern.
 *
 * Three separate things are configured here, and they are parsed separately on
 * purpose: signing in, origin-checking a mutation, and the dormant SSO bridge.
 * They used to share one schema, which meant an unset bridge credential — a
 * value the sign-in path never reads, and which
 * docs/backend/PARTICIPANT_SESSION.md says is deliberately not used — made
 * `/auth/login` throw. In production it did exactly that: the login button
 * returned 500 and nobody could sign in.
 *
 * A config error should disable the thing it configures and nothing else, so
 * each parser below takes only the values its own caller needs.
 */

const signInSchema = z.object({
  arenaOrigin: z.string().url(),
  canonicalOrigin: z.string().url(),
});

const ssoBridgeSchema = signInSchema.extend({
  clientId: z.literal("arena"),
  clientSecret: z.string().min(32),
  introspectionIntervalSeconds: z.coerce.number().int().min(30).max(300).default(60),
});

export type ArenaAuthConfig = z.infer<typeof signInSchema>;
export type ArenaSsoBridgeConfig = z.infer<typeof ssoBridgeSchema>;

function parseOrigin(value: string, environment: string | undefined, productionArena: boolean): string {
  try {
    const url = new URL(value);
    const isRootOrigin = url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
    const isLocalHttp = environment !== "production" && url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
    const isSecure = url.protocol === "https:";
    if (!isRootOrigin || (!isSecure && !isLocalHttp)) throw new Error("invalid");
    if (productionArena && url.origin !== "https://arena.sekolahkarir.id") throw new Error("invalid");
    return url.origin;
  } catch {
    throw new Error("Arena auth configuration is invalid.");
  }
}

/** What signing in and out need: where this app lives, and where the gate is. */
export function parseArenaAuthConfig(input: unknown, environment = process.env.NODE_ENV): ArenaAuthConfig {
  const result = signInSchema.safeParse(input);
  if (!result.success) throw new Error("Arena auth configuration is invalid.");
  return {
    arenaOrigin: parseOrigin(result.data.arenaOrigin, environment, environment === "production"),
    canonicalOrigin: parseOrigin(result.data.canonicalOrigin, environment, false),
  };
}

/**
 * The origins allowed to drive a state-changing request.
 *
 * `sk_participant` is scoped to the registrable domain, so SameSite=Lax still
 * sends it on a request from a sibling host: this allowlist is the real control
 * on cross-origin writes, not defence in depth. Production therefore accepts
 * only first-party origins that are already configured and already trusted with
 * the shared session — this app, and the main site whose secret it verifies
 * ("trust is symmetric", docs/backend/PARTICIPANT_SESSION.md). Anything else is
 * refused, in every environment, whatever the env var says.
 */
export function parseArenaMutationOrigins(input: unknown, environment = process.env.NODE_ENV): string[] {
  const result = z.object({
    arenaOrigin: z.string().url(),
    canonicalOrigin: z.string().url(),
    allowedOrigins: z.array(z.string().url()).min(1),
  }).safeParse(input);
  if (!result.success) throw new Error("Arena auth configuration is invalid.");

  const arenaOrigin = parseOrigin(result.data.arenaOrigin, environment, environment === "production");
  const canonicalOrigin = parseOrigin(result.data.canonicalOrigin, environment, false);
  const allowedOrigins = result.data.allowedOrigins.map((origin) => parseOrigin(origin, environment, false));
  if (environment === "production" && allowedOrigins.some((origin) => origin !== arenaOrigin && origin !== canonicalOrigin)) {
    throw new Error("Arena auth configuration is invalid.");
  }
  return allowedOrigins;
}

/**
 * The PKCE bridge's own credentials.
 *
 * Dormant: nothing on the request path calls this today, because the main site
 * has no token endpoint to call. Kept whole for the day it grows one — see
 * docs/backend/AUTH_INTEGRATION_CONTRACT.md — and parsed on its own so its
 * absence stays the bridge's problem rather than sign-in's.
 */
export function parseArenaSsoBridgeConfig(input: unknown, environment = process.env.NODE_ENV): ArenaSsoBridgeConfig {
  const result = ssoBridgeSchema.safeParse(input);
  if (!result.success) throw new Error("Arena SSO bridge configuration is invalid.");
  return {
    ...result.data,
    arenaOrigin: parseOrigin(result.data.arenaOrigin, environment, environment === "production"),
    canonicalOrigin: parseOrigin(result.data.canonicalOrigin, environment, false),
  };
}
