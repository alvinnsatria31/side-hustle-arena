import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ArenaDomainError } from "@/server/arena/errors";
import { getCurrentUser } from "@/server/auth/session";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";

export const arenaAdminScopes = ["overview", "reviews", "weeks", "projects", "rewards", "users", "storage", "notifications"] as const;
export type ArenaAdminScope = (typeof arenaAdminScopes)[number];

function deny(): never {
  throw new ArenaDomainError("FORBIDDEN", "Arena admin permission is required.");
}

function scopesFrom(value: unknown): ArenaAdminScope[] {
  if (!Array.isArray(value) || !value.every(scope => arenaAdminScopes.includes(scope))) deny();
  return value;
}

function subjectScopes(subject: string): ArenaAdminScope[] {
  let roles: Record<string, ArenaAdminScope[]> = {};
  if (process.env.ARENA_ADMIN_ROLES) {
    let parsed: unknown;
    try { parsed = JSON.parse(process.env.ARENA_ADMIN_ROLES); } catch { deny(); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) deny();
    roles = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, scopesFrom(value)]));
  }
  const subjects = (process.env.ARENA_ADMIN_SUBJECTS ?? "").split(/[\s,]+/).filter(Boolean);
  if (subjects.includes(subject)) return [...arenaAdminScopes];
  return Object.hasOwn(roles, subject) ? roles[subject] : [];
}

/** Session-only gate for Server Components; bearer credentials never render the console. */
export async function requireArenaAdminSession(): Promise<{ actorSubject: string; scopes: ArenaAdminScope[] }> {
  const user = await getCurrentUser();
  if (!user) deny();
  const scopes = subjectScopes(user.authSubject);
  if (!scopes.length) deny();
  return { actorSubject: user.authSubject, scopes };
}

/** Explicit credentials take precedence and cannot fall back to session authorization. */
export async function requireArenaAdmin(request: Request, scope: ArenaAdminScope): Promise<{ actorSubject: string }> {
  if (!arenaAdminScopes.includes(scope)) deny();
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const token = process.env.INTERNAL_ADMIN_TOKEN;
    const actorSubject = process.env.INTERNAL_ADMIN_SUBJECT?.trim();
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!token || !actorSubject || !match || token === process.env.INTERNAL_AUTOMATION_TOKEN) deny();
    const expected = Buffer.from(token);
    const presented = Buffer.from(match[1]);
    if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) deny();
    const scopes = scopesFrom((process.env.INTERNAL_ADMIN_SCOPES ?? "").split(/[\s,]+/).filter(Boolean));
    if (!scopes.includes(scope)) deny();
    return { actorSubject };
  }
  const admin = await requireArenaAdminSession();
  if (!admin.scopes.includes(scope)) deny();
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) && !hasAllowedMutationOrigin(request)) deny();
  return { actorSubject: admin.actorSubject };
}

/**
 * Scopes for a subject the caller has already resolved from the session.
 *
 * The signed-in chrome renders on every protected page and only needs to know
 * whether to show the console entrance, so it must not pay for a second
 * session read — and a malformed `ARENA_ADMIN_ROLES` should hide the entrance
 * rather than take down every page that renders the navbar.
 */
export function arenaAdminScopesFor(authSubject: string): ArenaAdminScope[] {
  try {
    return subjectScopes(authSubject);
  } catch {
    return [];
  }
}
