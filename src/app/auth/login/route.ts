import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/server/auth/config";
import { PARTICIPANT_COOKIE, verifyParticipantToken } from "@/server/auth/participant-token";

export const dynamic = "force-dynamic";

/**
 * Send an anonymous visitor to sign in.
 *
 * The Arena has no login of its own: it verifies the Sekolah Karir participant
 * session and nothing more. So "log in" means "go to the main site's Arena
 * gate", which raises the OTP modal and, once signed in, offers the door back
 * here — the door that re-scopes the cookie to the registrable domain so this
 * subdomain receives it.
 *
 * `returnTo` is not forwarded: the gate on the main site decides where a
 * participant lands, and a redirect target this app accepts from a query string
 * and hands to another origin is an open-redirect waiting to be found.
 *
 * The PKCE authorize flow this route used to build is kept in
 * src/server/auth/{pkce,authorization,sso-client}.ts for the day the main site
 * grows a token endpoint. See docs/backend/AUTH_INTEGRATION_CONTRACT.md.
 */
export async function GET(request: NextRequest) {
  // Someone who already holds a valid participant cookie is signed in; bouncing
  // them out to the main site to be told so is a round trip that ends where
  // they started. Verified from the token alone — no database, so a login link
  // never depends on the Arena's own storage being reachable.
  try {
    const token = (await cookies()).get(PARTICIPANT_COOKIE)?.value;
    if (await verifyParticipantToken(token)) {
      return NextResponse.redirect(new URL("/app", request.url), 302);
    }
  } catch {
    // A missing SESSION_SECRET is a broken deployment, but it is not a reason to
    // refuse to show someone the gate. Fall through and let them sign in.
  }

  const gate = new URL("/arena", getAuthConfig().canonicalOrigin);
  return NextResponse.redirect(gate, 302);
}
