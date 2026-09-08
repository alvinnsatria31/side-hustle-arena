import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { arenaData, arenaError, arenaUnauthorized } from "@/server/arena/http";
import { ArenaDomainError } from "@/server/arena/errors";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { deleteArenaAccount, getPrivacyState, setShowcaseConsent } from "@/server/arena/privacy-service";

export const dynamic = "force-dynamic";

/**
 * The participant's own privacy controls: Showcase consent, and deleting the
 * account. Both act only on the caller's own record — the user id comes from
 * the session, never from the body, so there is no id here to tamper with.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    return arenaData(await getPrivacyState(user.id));
  } catch (error) { return arenaError(error); }
}

const consentSchema = z.object({ showcaseConsent: z.boolean() }).strict();
const deleteSchema = z.object({
  // Typed confirmation, because this is not undoable and a stray POST must not
  // be enough to trigger it.
  confirm: z.literal("HAPUS AKUN"),
  reason: z.string().trim().max(500).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    if (!hasAllowedMutationOrigin(request)) throw new ArenaDomainError("FORBIDDEN", "Origin is not allowed for this action.");
    const parsed = consentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ArenaDomainError("VALIDATION_ERROR", "Invalid privacy request.");
    return arenaData(await setShowcaseConsent({ userId: user.id, consent: parsed.data.showcaseConsent }));
  } catch (error) { return arenaError(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    if (!hasAllowedMutationOrigin(request)) throw new ArenaDomainError("FORBIDDEN", "Origin is not allowed for this action.");
    const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ArenaDomainError("VALIDATION_ERROR", 'Account deletion requires confirm: "HAPUS AKUN".');
    }
    const result = await deleteArenaAccount({
      userId: user.id,
      requestedBy: "USER",
      actorSubject: user.authSubject,
      reason: parsed.data.reason,
    });
    return arenaData({ deleted: true, anonymizedAt: result.anonymizedAt, erased: result.erased });
  } catch (error) { return arenaError(error); }
}
