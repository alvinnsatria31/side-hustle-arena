import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { hashOpaqueToken, generateOpaqueToken } from "./crypto";
import { getArenaSessionExpiry } from "./expiry";
import { getParticipantUser } from "./participant-session";


export type ArenaUser = { id: string; authSubject: string; email: string | null; displayName: string | null; avatarUrl: string | null };

export async function provisionAndCreateSession(input: {
  subject: string; grantId: string; grantExpiresAt: Date; profile: { email: string; displayName: string; avatarUrl: string | null };
}) {
  const db = getDb();
  const provisioned = await db.insert(users).values({
    authSubject: input.subject, emailCache: input.profile.email, displayNameCache: input.profile.displayName, avatarUrlCache: input.profile.avatarUrl,
  }).onConflictDoUpdate({
    target: users.authSubject,
    set: { emailCache: input.profile.email, displayNameCache: input.profile.displayName, avatarUrlCache: input.profile.avatarUrl, updatedAt: new Date() },
  }).returning({ id: users.id });
  const token = generateOpaqueToken();
  const expiresAt = getArenaSessionExpiry(input.grantExpiresAt);
  if (expiresAt <= new Date()) throw new Error("Canonical grant has expired.");
  await db.insert(sessions).values({ userId: provisioned[0].id, tokenHash: hashOpaqueToken(token), canonicalGrantId: input.grantId, expiresAt });
  return { token, expiresAt };
}

/**
 * Who is signed in.
 *
 * The Arena reads the Sekolah Karir participant session (`sk_participant`,
 * shared across `sekolahkarir.id` and its subdomains) rather than minting one
 * of its own — the same arrangement the previous Arena deployment used, so a
 * participant who is already logged in stays logged in across the swap.
 *
 * The SSO bridge below (PKCE authorize/callback/introspection) is kept intact
 * and deliberately off this path. It is the documented upgrade for the day the
 * main site grows a token endpoint; see docs/backend/AUTH_INTEGRATION_CONTRACT.md.
 */
export async function getCurrentUser(): Promise<ArenaUser | null> {
  return getParticipantUser();
}

export async function revokeArenaSessionByToken(token: string): Promise<void> {
  await getDb().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashOpaqueToken(token)));
}

// cleanupExpiredArenaSessions moved to ./session-retention so the scheduler and
// offline tests can run it without pulling in next/headers.
