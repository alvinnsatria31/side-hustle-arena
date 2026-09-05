import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/server/auth/config";

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
export async function GET(_request: NextRequest) {
  const gate = new URL("/arena", getAuthConfig().canonicalOrigin);
  return NextResponse.redirect(gate, 302);
}
