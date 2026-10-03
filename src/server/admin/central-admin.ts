/**
 * The switch that retires Arena's own admin console.
 *
 * The unified admin lives on the main website and drives Arena through the
 * internal API. Once it is live, the console under `/app/admin` should stop
 * being a second place to do the same work — but only once it is live. The
 * API and the redirect ship in the same image, and the API has to be deployed
 * first for the central panel to have anything to talk to, so "the image is
 * running" must not mean "the old console is gone".
 *
 * So the redirect is a runtime decision, and it is off until somebody turns it
 * on: `ARENA_CENTRAL_ADMIN_URL` unset means the console is served exactly as
 * before. It used to be a `redirects()` entry in next.config.mjs, which Next
 * evaluates at build time — the destination was whatever SK_AUTH_ORIGIN the
 * build saw (the Dockerfile's `http://localhost:3000` placeholder), and
 * enabling or reverting it needed a rebuild.
 *
 * Deliberately free of `server-only` and of every other import: the proxy and
 * the offline suites both read it.
 */

export const CENTRAL_ADMIN_ENV = "ARENA_CENTRAL_ADMIN_URL";
export const LEGACY_KEEP_ENV = "ARENA_LEGACY_ADMIN_KEEP";

/**
 * Console sections the unified admin cannot fully do yet.
 *
 * Turning the redirect on for these would not move the work, it would remove
 * it. Some have no screen in the central panel at all (the email outbox, the
 * scheduler, ad-hoc launch, the careers and CV tools). The rest have a screen
 * that lacks an action only this console offers: uploading a product file and
 * confirming a payment by hand (`store`), pushing or voiding a voucher
 * (`rewards`), editing or regenerating a project (`projects`). `weeks` has every
 * button in the panel, but a generation or publication that SUCCEEDS has never
 * been run from it — only their refusals have. An operator sent away from
 * those mid-incident has nowhere to do them.
 *
 * They stay on the legacy console until the panel has them — shrink this list
 * (or set ARENA_LEGACY_ADMIN_KEEP) as each one lands, never before. "Lands"
 * means the panel's screen exists and every action on it has been run against
 * Arena; see docs/UNIFIED-ADMIN-HANDOFF.md for the record of each move.
 */
export const LEGACY_ONLY_SECTIONS = [
  "email", "jobs", "workflows", "careers", "career-report", "cv-scanner",
  "store", "rewards", "projects", "weeks",
] as const;

/**
 * Console sections the central panel covers completely, so nothing is lost by
 * redirecting them. Every folder under /app/admin must be in exactly one of the
 * two lists — a new section is a decision, not a default (see the redirect
 * suite), because the default for an unlisted path is to redirect it.
 */
export const CENTRAL_COVERED_SECTIONS = ["audit", "users", "flags", "divisions", "reviews"] as const;

export type CentralAdminTarget =
  | { enabled: false; reason: "unset" | "invalid"; problem?: string }
  | { enabled: true; url: string };

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Where the legacy console should send people, or why it should not.
 *
 * A value that cannot be trusted disables the redirect rather than breaking the
 * console: an operator who mistypes the URL keeps a working admin and a logged
 * reason, instead of a redirect to nowhere and no way back in.
 */
export function resolveCentralAdmin(env: Record<string, string | undefined> = process.env): CentralAdminTarget {
  const raw = env[CENTRAL_ADMIN_ENV]?.trim();
  if (!raw) return { enabled: false, reason: "unset" };

  const invalid = (problem: string): CentralAdminTarget => ({ enabled: false, reason: "invalid", problem });
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return invalid("not an absolute URL");
  }
  if (url.username || url.password) return invalid("must not carry credentials");
  if (url.search || url.hash) return invalid("must not carry a query string or fragment");

  // Plain HTTP only for a loopback panel outside production, so a local
  // integration run can exercise the switch without a certificate.
  const localRun = LOOPBACK.includes(url.hostname) && (env.NODE_ENV !== "production" || env.APP_ENV === "test" || env.APP_ENV === "development");
  if (url.protocol !== "https:" && !(localRun && url.protocol === "http:")) return invalid("must use HTTPS");

  // Pointing the console at its own origin is a redirect loop that locks every
  // operator out, and the one mistake a copy-pasted ARENA_ORIGIN makes easy.
  let arenaOrigin = "https://arena.sekolahkarir.id";
  try {
    arenaOrigin = new URL(env.ARENA_ORIGIN?.trim() || arenaOrigin).origin;
  } catch { /* An unparseable ARENA_ORIGIN is reported by the auth config, not here. */ }
  if (url.origin === arenaOrigin) return invalid("must be the central admin, not the Arena itself");

  return { enabled: true, url: url.toString() };
}

/**
 * Which console sections stay on the legacy UI while the redirect is on.
 *
 * Unset means the built-in list above. `none` means the central panel has
 * everything and the whole console redirects. Anything else is a
 * comma-separated list of section names (the path segment after /app/admin/).
 */
export function legacySectionsKept(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env[LEGACY_KEEP_ENV]?.trim();
  if (raw === undefined || raw === "") return [...LEGACY_ONLY_SECTIONS];
  if (raw.toLowerCase() === "none") return [];
  return [...new Set(raw.split(/[\s,]+/).map((entry) => entry.trim().toLowerCase()).filter((entry) => /^[a-z0-9-]+$/.test(entry)))];
}

/** Should this console path be sent to the central panel? */
export function redirectsToCentral(pathname: string, env: Record<string, string | undefined> = process.env): boolean {
  const match = /^\/app\/admin\/([^/]+)/.exec(pathname);
  // The console root and the old /admin alias always follow the switch: the
  // operator's way in is the central panel once it is on.
  if (!match) return true;
  return !legacySectionsKept(env).includes(match[1].toLowerCase());
}
