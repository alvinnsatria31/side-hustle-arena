import { NextRequest, NextResponse } from "next/server";
import { generateOpaqueToken } from "@/server/auth/crypto";
import { setTemporaryCookie, ARENA_PKCE_COOKIE, ARENA_RETURN_COOKIE, ARENA_STATE_COOKIE } from "@/server/auth/cookies";
import { getAuthConfig, getArenaCallbackUri } from "@/server/auth/config";
import { toS256Challenge } from "@/server/auth/pkce";
import { sanitizeInternalReturnPath } from "@/server/auth/return-path";

export async function GET(request: NextRequest) {
  const state = generateOpaqueToken();
  const verifier = generateOpaqueToken();
  const returnTo = sanitizeInternalReturnPath(request.nextUrl.searchParams.get("returnTo"));
  const config = getAuthConfig();
  const authorizeUrl = new URL("/api/sso/arena/authorize", config.canonicalOrigin);
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", getArenaCallbackUri());
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", toS256Challenge(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  const response = NextResponse.redirect(authorizeUrl);
  setTemporaryCookie(response, ARENA_STATE_COOKIE, state);
  setTemporaryCookie(response, ARENA_PKCE_COOKIE, verifier);
  setTemporaryCookie(response, ARENA_RETURN_COOKIE, returnTo);
  return response;
}
