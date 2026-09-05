import { jwtVerify } from "jose";

/**
 * Reading the Sekolah Karir participant session.
 *
 * The Arena does not log anyone in. A participant signs in on the main site and
 * receives `sk_participant`: an HS256 JWT signed with SESSION_SECRET, scoped in
 * production to `Domain=sekolahkarir.id` so every sibling host — this one
 * included — receives it. Our job is only to verify that signature and read the
 * claims; issuing, refreshing and revoking all stay with the main site.
 *
 * Deliberately free of `next/headers` and of any database import, so the proxy,
 * the scheduler and the offline test suites can all verify a token without
 * dragging a request context or a DB client behind them.
 *
 * The algorithm is pinned to HS256. `jose` will not accept a token whose header
 * announces anything else, which closes the "alg: none" and RS256-confusion
 * family of forgeries — a token is only ever checked against the shared secret.
 */

export const PARTICIPANT_COOKIE = "sk_participant";

const ALGORITHM = "HS256";

export interface ParticipantClaims {
  /** Participant.id on the main site — stable for the life of the account. */
  sub: string;
  email: string;
  username: string;
  firstName: string;
}

export class ParticipantSecretMissingError extends Error {
  constructor() {
    super("SESSION_SECRET is required to verify the Sekolah Karir participant session.");
    this.name = "ParticipantSecretMissingError";
  }
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  // Fail loudly rather than returning "not signed in": a missing secret is a
  // misconfigured deployment, not an anonymous visitor, and silently treating
  // every participant as logged out would look like a mass logout instead.
  if (!secret) throw new ParticipantSecretMissingError();
  return new TextEncoder().encode(secret);
}

/**
 * Verify a `sk_participant` token.
 *
 * Returns null for anything a visitor could plausibly be holding — no token, an
 * expired one, a tampered one, a token missing claims — because none of those
 * are exceptional; they all mean "not signed in". Only a misconfigured secret
 * throws.
 */
export async function verifyParticipantToken(token: string | undefined | null): Promise<ParticipantClaims | null> {
  if (!token) return null;
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
    if (
      typeof payload.sub !== "string" || payload.sub.length === 0 ||
      typeof payload.email !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.firstName !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
      firstName: payload.firstName,
    };
  } catch {
    return null;
  }
}

/**
 * The Arena's identity for a participant.
 *
 * Prefixed so a row's provenance is readable at a glance and can never collide
 * with a subject minted by the SSO bridge, which is kept for a possible future
 * migration (see docs/backend/AUTH_INTEGRATION_CONTRACT.md).
 */
export function arenaSubjectFor(claims: Pick<ParticipantClaims, "sub">): string {
  return `sk-participant:${claims.sub}`;
}
