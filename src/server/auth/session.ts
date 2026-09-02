import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { ARENA_SESSION_COOKIE } from "./cookies";
import { hashOpaqueToken, generateOpaqueToken } from "./crypto";
import { getAuthConfig } from "./config";
import { getArenaSessionExpiry } from "./expiry";
import { introspectArenaGrant } from "./sso-client";

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

export async function getCurrentUser(): Promise<ArenaUser | null> {
  const token = (await cookies()).get(ARENA_SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const rows = await db.select({ session: sessions, user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashOpaqueToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), eq(users.status, "ACTIVE")));
  const row = rows[0];
  if (!row) return null;
  const intervalMs = getAuthConfig().introspectionIntervalSeconds * 1_000;
  if (!row.session.lastCanonicalCheckAt || row.session.lastCanonicalCheckAt.getTime() + intervalMs <= Date.now()) {
    try {
      const result = await introspectArenaGrant(row.session.canonicalGrantId);
      if (!result.active || result.subject !== row.user.authSubject) throw new Error("inactive grant");
      await db.update(sessions).set({ lastCanonicalCheckAt: new Date() }).where(eq(sessions.id, row.session.id));
    } catch {
      await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, row.session.id));
      return null;
    }
  }
  return { id: row.user.id, authSubject: row.user.authSubject, email: row.user.emailCache, displayName: row.user.displayNameCache, avatarUrl: row.user.avatarUrlCache };
}

export async function revokeArenaSessionByToken(token: string): Promise<void> {
  await getDb().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashOpaqueToken(token)));
}
