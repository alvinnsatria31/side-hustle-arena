/**
 * Where a participant is allowed to land after signing in.
 *
 * Deliberately dependency-free and free of `server-only`: the sign-in popup hook
 * imports this too, so the browser and the `/auth/callback` route agree on one
 * definition of a safe destination rather than drifting apart. Keep it that way
 * — anything server-side added here would break the client build.
 */
const APP_ORIGIN = "https://arena.local";

export function sanitizeInternalReturnPath(value: string | null | undefined): string {
  if (!value) return "/app";
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return "/app";
    const url = new URL(decoded, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN || (url.pathname !== "/app" && !url.pathname.startsWith("/app/"))) {
      return "/app";
    }
    return url.pathname + url.search;
  } catch {
    return "/app";
  }
}
