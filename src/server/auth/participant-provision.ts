import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { arenaSubjectFor, type ParticipantClaims } from "./participant-token";

export type ArenaUser = {
  id: string;
  authSubject: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Mirror a Sekolah Karir participant into the Arena's own identity table.
 *
 * The main site owns the account; the Arena keeps just enough of it to own its
 * rows — enrolments, submissions, points — by foreign key. The mirror is keyed
 * on `sk-participant:<Participant.id>`, which survives the person changing
 * their email or username.
 *
 * Kept apart from the cookie reader so the scheduler and the offline suites can
 * exercise it without `next/headers`, the same split as session-retention.ts.
 */
export async function provisionParticipant(claims: ParticipantClaims): Promise<ArenaUser | null> {
  const db = getDb();
  const authSubject = arenaSubjectFor(claims);
  const displayName = claims.firstName || claims.username;

  const existing = (await db.select().from(users).where(eq(users.authSubject, authSubject)))[0];

  if (!existing) {
    const created = (await db.insert(users).values({
      authSubject,
      emailCache: claims.email,
      displayNameCache: displayName,
      lastSeenAt: new Date(),
    }).onConflictDoUpdate({
      // Two tabs signing in at once race here; the upsert makes the loser read
      // back the winner's row instead of failing the request.
      target: users.authSubject,
      set: { emailCache: claims.email, displayNameCache: displayName, lastSeenAt: new Date(), updatedAt: new Date() },
    }).returning())[0];
    return created.status === "ACTIVE" ? serialize(created) : null;
  }

  // The Arena can bar someone from the competition without touching their
  // Sekolah Karir login, so a valid session still resolves to nobody here.
  if (existing.status !== "ACTIVE") return null;

  // Only write when the mirrored profile actually drifted, so an ordinary page
  // view stays a single read.
  if (existing.emailCache !== claims.email || existing.displayNameCache !== displayName) {
    const updated = (await db.update(users)
      .set({ emailCache: claims.email, displayNameCache: displayName, lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning())[0];
    return serialize(updated);
  }

  return serialize(existing);
}

function serialize(row: typeof users.$inferSelect): ArenaUser {
  return {
    id: row.id,
    authSubject: row.authSubject,
    email: row.emailCache,
    displayName: row.displayNameCache,
    avatarUrl: row.avatarUrlCache,
  };
}
