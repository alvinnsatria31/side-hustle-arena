import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

export { getCurrentUser };

/**
 * The guard on every protected page.
 *
 * An anonymous visitor lands on the Arena's own sign-in card, not on the main
 * site. `/auth/login` would have handed the whole tab to sekolahkarir.id before
 * the person saw anything of the Arena — which is exactly what deep-linking
 * into `/app` while signed out used to do. `/login` keeps them here and opens
 * the gate in a popup instead.
 *
 * `returnTo` is where they continue afterwards; the login page sanitises it to
 * an internal `/app` path before using it.
 */
export async function requireCurrentUser(returnTo = "/app") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}
