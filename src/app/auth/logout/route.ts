import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/server/auth/config";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { PARTICIPANT_COOKIE } from "@/server/auth/participant-token";

export const dynamic = "force-dynamic";

/**
 * Sign out.
 *
 * The session being cleared belongs to Sekolah Karir, not to the Arena, and in
 * production it is scoped to the registrable domain — so this logs the
 * participant out of the main site too. That is the honest consequence of one
 * shared session: there is no "log out of the Arena only" to offer, and
 * pretending otherwise would leave someone signed in where they thought they
 * had left.
 *
 * COOKIE_DOMAIN has to match what the main site set, or the browser keeps the
 * original cookie and the person stays signed in — a silent no-op is the one
 * outcome a logout button must never have.
 */
export async function POST(request: NextRequest) {
  if (!hasAllowedMutationOrigin(request)) return new NextResponse(null, { status: 403 });

  const response = NextResponse.redirect(new URL(getAuthConfig().canonicalOrigin), { status: 303 });
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  response.cookies.set({
    name: PARTICIPANT_COOKIE,
    value: "",
    httpOnly: true,
    secure: new URL(getAuthConfig().arenaOrigin).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
  return response;
}
