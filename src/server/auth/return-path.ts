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
