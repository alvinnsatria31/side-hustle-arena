import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { isValidAvatarId } from "@/lib/avatars";

/**
 * Store the preset avatar a participant picked.
 *
 * The id is checked against the catalogue here rather than only in the route,
 * because this column is read straight into `<img>`-shaped markup on the
 * leaderboard and the navbar: an id that never matches a preset would render a
 * blank identity for everyone looking at that row, not just its owner.
 *
 * Returns false for an unknown id and for a user row that is not there, so the
 * caller can answer 400 without a second query. Kept free of `next/headers` so
 * the offline suites can exercise it, the same split as participant-provision.
 */
export async function setParticipantAvatar(userId: string, avatarId: string, db = getDb()): Promise<boolean> {
  if (!isValidAvatarId(avatarId)) return false;
  const updated = await db
    .update(users)
    .set({ avatarId, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  return updated.length > 0;
}
