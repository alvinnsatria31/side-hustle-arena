/**
 * Test-only stand-in for `next/navigation`.
 *
 * Same reason as the `next/headers` stub: route and server modules import it at
 * module scope, and it only exists inside the Next runtime. `redirect` throws
 * the way the real one does (it is a control-flow signal, not a return), so a
 * test that trips a redirect path fails loudly instead of continuing as if the
 * user had been sent somewhere.
 */
export function redirect(url) {
  const error = new Error(`NEXT_REDIRECT: ${url}`);
  error.digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw error;
}
export function notFound() {
  const error = new Error("NEXT_NOT_FOUND");
  error.digest = "NEXT_HTTP_ERROR_FALLBACK;404";
  throw error;
}
export function permanentRedirect(url) { return redirect(url); }
