import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clearTemporaryCookies, setArenaSessionCookie, ARENA_PKCE_COOKIE, ARENA_RETURN_COOKIE, ARENA_STATE_COOKIE } from "@/server/auth/cookies";
import { matchesState } from "@/server/auth/crypto";
import { provisionAndCreateSession } from "@/server/auth/session";
import { sanitizeInternalReturnPath } from "@/server/auth/return-path";
import { exchangeArenaCode } from "@/server/auth/sso-client";

const callbackSchema = z.object({ code: z.string().min(43).max(512), state: z.string().min(16).max(512) });

function failure(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  clearTemporaryCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const parsed = callbackSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(ARENA_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(ARENA_PKCE_COOKIE)?.value;
  if (!parsed.success || !expectedState || !verifier || !matchesState(expectedState, parsed.data.state)) return failure(request);
  try {
    const exchange = await exchangeArenaCode(parsed.data.code, verifier);
    const session = await provisionAndCreateSession({
      subject: exchange.subject,
      grantId: exchange.grantId,
      grantExpiresAt: new Date(exchange.expiresAt),
      profile: exchange.profile,
    });
    const response = NextResponse.redirect(new URL(sanitizeInternalReturnPath(cookieStore.get(ARENA_RETURN_COOKIE)?.value), request.url));
    setArenaSessionCookie(response, session.token, session.expiresAt);
    clearTemporaryCookies(response);
    return response;
  } catch {
    return failure(request);
  }
}
