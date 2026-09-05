import "server-only";
import { cookies } from "next/headers";
import { PARTICIPANT_COOKIE, verifyParticipantToken } from "./participant-token";
import { provisionParticipant, type ArenaUser } from "./participant-provision";

export type { ArenaUser };

/**
 * Resolve the signed-in participant for this request.
 *
 * The Arena issues no session of its own — it verifies the Sekolah Karir
 * participant cookie, which in production is scoped to the registrable domain
 * so every sibling host receives it, and mirrors the account locally.
 */
export async function getParticipantUser(): Promise<ArenaUser | null> {
  const token = (await cookies()).get(PARTICIPANT_COOKIE)?.value;
  const claims = await verifyParticipantToken(token);
  if (!claims) return null;
  return provisionParticipant(claims);
}
