import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/server/auth/config";
import { PARTICIPANT_COOKIE, verifyParticipantToken } from "@/server/auth/participant-token";

export const dynamic = "force-dynamic";

/**
 * Send an anonymous visitor to sign in.
 *
 * The Arena has no login of its own: it verifies the Sekolah Karir participant
 * session and nothing more. So "log in" means "go to the main site's sign-in
 * gate" (`/masuk`), which signs the visitor in and then sends them on to `next`.
 * Sessions are scoped to the registrable domain, so this subdomain receives the
 * cookie as soon as it exists.
 *
 * This used to point at the main site's `/arena` teaser page. That page was
 * removed in October 2026; `/arena` there now only forwards to `/masuk`, and
 * going straight to the gate saves the extra hop.
 *
 * `returnTo` is not forwarded: `next` is always this app's own `/app`, built
 * here from configuration. A redirect target accepted from a query string and
 * handed to another origin is an open-redirect waiting to be found. The gate
 * independently refuses any destination that is not one of our own origins.
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

  const { arenaOrigin, canonicalOrigin } = getAuthConfig();
  const gate = new URL("/masuk", canonicalOrigin);
  gate.searchParams.set("next", new URL("/app", arenaOrigin).toString());
  return NextResponse.redirect(gate, 302);
}
