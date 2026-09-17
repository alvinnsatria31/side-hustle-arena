/**
 * The shop's launch switch, for the browser.
 *
 * A mirror of `isStoreEnabled()` in `src/server/store/config.ts`, reading the
 * same `NEXT_PUBLIC_STORE_ENABLED`. Two copies rather than one import because
 * the server module carries `server-only` — pulling it into the navbar would
 * break the build — and because the value must be inlined at build time for the
 * client bundle. `process.env.NEXT_PUBLIC_STORE_ENABLED` is written out in full
 * on purpose: Next.js substitutes it statically, so a destructured or computed
 * lookup would read `undefined` in the browser.
 */
export function isStoreEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STORE_ENABLED === 'true';
}
