import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ArenaDomainError } from "@/server/arena/errors";
import { getCurrentUser } from "@/server/auth/session";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";

// `careers` covers the Jobs pipeline: source health, manual sync, enable and
// disable. `store` covers the digital shop: products, uploads, orders and
// refunds — kept apart from `rewards` because one hands out prizes and the
// other moves customers' money. A subject listed in ARENA_ADMIN_SUBJECTS receives every scope, so
// adding one here does not orphan an existing admin; a subject granted scopes
// individually through ARENA_ADMIN_ROLES (or the bearer path's
// INTERNAL_ADMIN_SCOPES) needs "careers" added explicitly.
export const arenaAdminScopes = ["overview", "reviews", "weeks", "projects", "rewards", "users", "storage", "notifications", "careers", "store"] as const;
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

/** The central admin's own bearer must be long enough to be a secret, not a label. */
const CENTRAL_ADMIN_TOKEN_MIN_LENGTH = 32;

/**
 * The service bearers this deployment accepts, each with its own identity.
 *
 * Two, on purpose. `INTERNAL_ADMIN_TOKEN` already has a holder: the n8n ad-hoc
 * launch workflow, which needs `projects` and nothing else. The unified admin
 * on the main website needs nearly every scope. Serving both from one token
 * would hand the automation box the right to refund orders and suspend users,
 * and would write both under one subject — the audit trail could no longer say
 * whether a person or a workflow did something. `CENTRAL_ADMIN_*` is a second
 * credential with its own subject and its own scopes; neither widens the other.
 *
 * Every rule is fail-closed and per credential: unset means absent, a token
 * shared with the automation worker is refused, and a central token that
 * merely repeats the internal one is ignored rather than trusted twice.
 */
function serviceCredentials(env: NodeJS.ProcessEnv): Array<{ token: string; actorSubject: string; scopes: string }> {
  const automation = env.INTERNAL_AUTOMATION_TOKEN;
  const credentials: Array<{ token: string; actorSubject: string; scopes: string }> = [];
  const internal = env.INTERNAL_ADMIN_TOKEN;
  const internalSubject = env.INTERNAL_ADMIN_SUBJECT?.trim();
  if (internal && internalSubject && internal !== automation) {
    credentials.push({ token: internal, actorSubject: internalSubject, scopes: env.INTERNAL_ADMIN_SCOPES ?? "" });
  }
  const central = env.CENTRAL_ADMIN_TOKEN;
  const centralSubject = env.CENTRAL_ADMIN_SUBJECT?.trim();
  if (central && centralSubject && central.length >= CENTRAL_ADMIN_TOKEN_MIN_LENGTH && central !== automation && central !== internal) {
    credentials.push({ token: central, actorSubject: centralSubject, scopes: env.CENTRAL_ADMIN_SCOPES ?? "" });
  }
  return credentials;
}

/** Explicit credentials take precedence and cannot fall back to session authorization. */
export async function requireArenaAdmin(request: Request, scope: ArenaAdminScope): Promise<{ actorSubject: string }> {
  if (!arenaAdminScopes.includes(scope)) deny();
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) deny();
    const presented = Buffer.from(match[1]);
    // Every configured credential is compared, so the time taken does not say
    // which one a near-miss resembled.
    let matched: { actorSubject: string; scopes: string } | undefined;
    for (const credential of serviceCredentials(process.env)) {
      const expected = Buffer.from(credential.token);
      if (expected.length === presented.length && timingSafeEqual(expected, presented)) matched = credential;
    }
    if (!matched) deny();
    const scopes = scopesFrom(matched.scopes.split(/[\s,]+/).filter(Boolean));
    if (!scopes.includes(scope)) deny();
    return { actorSubject: matched.actorSubject };
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
