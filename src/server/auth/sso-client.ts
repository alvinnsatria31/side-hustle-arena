import "server-only";
import { z } from "zod";
import { getArenaCallbackUri, getAuthConfig } from "./config";

const exchangeSchema = z.object({
  subject: z.string().uuid(),
  grantId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  profile: z.object({
    email: z.string().email(),
    displayName: z.string().min(1),
    avatarUrl: z.string().url().nullable(),
  }),
});
const introspectionSchema = z.object({ active: z.boolean(), subject: z.string().uuid().optional(), expiresAt: z.string().datetime().optional() });

async function canonicalPost(path: string, body: unknown) {
  const config = getAuthConfig();
  const response = await fetch(new URL(path, config.canonicalOrigin), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + config.clientSecret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Canonical SSO request failed.");
  return response.json();
}

export async function exchangeArenaCode(code: string, codeVerifier: string) {
  const config = getAuthConfig();
  return exchangeSchema.parse(await canonicalPost("/api/sso/arena/token", {
    clientId: config.clientId,
    code,
    redirectUri: getArenaCallbackUri(),
    codeVerifier,
  }));
}

export async function introspectArenaGrant(grantId: string) {
  return introspectionSchema.parse(await canonicalPost("/api/sso/arena/introspect", { grantId }));
}

export async function revokeArenaGrant(grantId: string): Promise<void> {
  await canonicalPost("/api/sso/arena/revoke", { grantId });
}
