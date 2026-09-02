import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { ARENA_SESSION_COOKIE, clearArenaSessionCookie } from "@/server/auth/cookies";
import { hashOpaqueToken } from "@/server/auth/crypto";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { revokeArenaSessionByToken } from "@/server/auth/session";
import { revokeArenaGrant } from "@/server/auth/sso-client";

export async function POST(request: NextRequest) {
  if (!hasAllowedMutationOrigin(request)) return new NextResponse(null, { status: 403 });
  const token = (await cookies()).get(ARENA_SESSION_COOKIE)?.value;
  if (token) {
    const row = await getDb().select({ grantId: sessions.canonicalGrantId }).from(sessions).where(eq(sessions.tokenHash, hashOpaqueToken(token)));
    if (row[0]) {
      try { await revokeArenaGrant(row[0].grantId); } catch { /* local logout still succeeds */ }
    }
    await revokeArenaSessionByToken(token);
  }
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  clearArenaSessionCookie(response);
  return response;
}
