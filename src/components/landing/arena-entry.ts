/**
 * One door into the Arena, and one place that decides where it leads.
 *
 * The landing page is a hook for people who have never signed in, so every
 * call to action on it — header button, hero button, each project card, the
 * empty state — has to resolve to the same destination and the same sign-in
 * detour. Four components deciding that separately is how a page ends up
 * sending half its clicks to `/app` and the other half to a login screen that
 * forgets where the visitor was going.
 *
 * There is no Arena login. A signed-out visitor goes to the Arena's sign-in
 * card, which opens the Sekolah Karir gate in a popup and continues to the
 * dashboard afterwards; `returnTo` is sanitised there to an internal `/app`
 * path before it is used.
 */

/** The Arena dashboard — where a participant actually works. */
export const ARENA_DASHBOARD_PATH = '/app/arena';

/** The single primary call to action, worded the same everywhere. */
export const ARENA_ENTRY_LABEL = 'Masuk Arena';

export function arenaEntryHref(signedIn: boolean): string {
  if (signedIn) return ARENA_DASHBOARD_PATH;
  return `/login?returnTo=${encodeURIComponent(ARENA_DASHBOARD_PATH)}`;
}
