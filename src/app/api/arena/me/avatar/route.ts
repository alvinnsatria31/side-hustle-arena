import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { ArenaDomainError, arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena";
import { setParticipantAvatar } from "@/server/auth/avatar";

export const dynamic = "force-dynamic";

const avatarSchema = z.object({ avatarId: z.string().trim().min(1).max(64) });

/**
 * Pick the preset avatar shown on the leaderboard and in the navbar.
 *
 * The target is always the caller's own row — `user.id` comes from the verified
 * session, never from the body — so there is no id to authorize and no way to
 * dress up someone else's row.
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    const parsed = avatarSchema.safeParse(await request.json().catch(() => null));
    // An id outside the catalogue is refused rather than stored: this column is
    // read straight into display markup on every surface that lists people, so
    // an unknown id would blank an identity for everyone looking, not just its
    // owner. `setParticipantAvatar` re-checks it — the guard belongs with the
    // write, not only with the route that happens to call it today.
    if (!parsed.success || !(await setParticipantAvatar(user.id, parsed.data.avatarId))) {
      throw new ArenaDomainError("VALIDATION_ERROR", "Avatar tidak dikenali.");
    }
    return arenaData({ avatarId: parsed.data.avatarId });
  } catch (error) {
    return arenaError(error);
  }
}
