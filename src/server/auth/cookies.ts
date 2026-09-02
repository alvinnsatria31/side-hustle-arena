import "server-only";
import type { NextResponse } from "next/server";
import { getAuthConfig } from "./config";

export const ARENA_SESSION_COOKIE = "arena_session";
export const ARENA_STATE_COOKIE = "arena_sso_state";
export const ARENA_PKCE_COOKIE = "arena_sso_pkce";
export const ARENA_RETURN_COOKIE = "arena_sso_return";
const TEMPORARY_COOKIE_SECONDS = 10 * 60;

function secure() {
  return new URL(getAuthConfig().arenaOrigin).protocol === "https:";
}

export function setTemporaryCookie(response: NextResponse, name: string, value: string) {
  response.cookies.set({ name, value, httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: TEMPORARY_COOKIE_SECONDS });
}

export function clearTemporaryCookies(response: NextResponse) {
  for (const name of [ARENA_STATE_COOKIE, ARENA_PKCE_COOKIE, ARENA_RETURN_COOKIE]) {
    response.cookies.set({ name, value: "", httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: 0 });
  }
}

export function setArenaSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set({ name: ARENA_SESSION_COOKIE, value: token, httpOnly: true, secure: secure(), sameSite: "lax", path: "/", expires: expiresAt });
}

export function clearArenaSessionCookie(response: NextResponse) {
  response.cookies.set({ name: ARENA_SESSION_COOKIE, value: "", httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: 0 });
}
