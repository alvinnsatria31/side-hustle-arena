import { cookies } from "next/headers";
import { PARTICIPANT_COOKIE, ParticipantSecretMissingError, verifyParticipantToken } from "@/server/auth/participant-token";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * "Am I signed in yet?"
 *
 * The sign-in popup polls this. The gate that actually signs someone in lives on
 * the main site, so nothing on this origin gets to observe that navigation — but
 * the cookie it sets is scoped to the registrable domain, so the moment it lands
 * this route sees it. That is the whole handshake: no postMessage contract to
 * agree with the other repo, and no dependency on where the gate chooses to send
 * the browser afterwards.
 *
 * Deliberately token-only — no database, no user mirror. It is polled once a
 * second per open popup and must stay a signature check, and it must keep
 * answering while the Arena's own storage is unreachable. It therefore says
 * nothing about *who* is signed in; `/api/arena/me` is where identity lives.
 */
export async function GET() {
  try {
    const token = (await cookies()).get(PARTICIPANT_COOKIE)?.value;
    return Response.json({ data: { signedIn: (await verifyParticipantToken(token)) !== null } }, { headers: noStore });
  } catch (error) {
    // A missing secret means nobody can ever sign in. Reporting that as "not
    // signed in" would leave the popup polling a loop that cannot terminate, so
    // fail loudly enough for the client to stop and say so.
    if (error instanceof ParticipantSecretMissingError) {
      return Response.json({ error: { code: "INTERNAL_ERROR", message: "Sign-in is unavailable." } }, { status: 503, headers: noStore });
    }
    return Response.json({ error: { code: "INTERNAL_ERROR", message: "Sign-in is unavailable." } }, { status: 500, headers: noStore });
  }
}
