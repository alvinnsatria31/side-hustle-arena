import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { Footer } from '@/components/layout/Footer';
import { getCurrentUser } from '@/server/auth';
import type { PublicNavUser } from '@/components/layout/PublicUserMenu';

/**
 * The public shell.
 *
 * These pages do not require a session, but they must recognise one. A
 * participant signed in on sekolahkarir.id already holds the shared cookie when
 * they land here, and showing them "Masuk" was the whole of the confusion:
 * nothing was actually asking them to sign in again, the header just never
 * looked.
 *
 * Reading the cookie here opts these pages into dynamic rendering — the price
 * of a header that tells the truth, and one most of this group already paid
 * (every /arena route is force-dynamic already).
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // A marketing page must render even when the Arena's own storage or secret is
  // not reachable. Failing to resolve a session is not the same as failing to
  // serve the page: fall back to the signed-out header rather than a 500.
  let user: PublicNavUser | null = null;
  try {
    const current = await getCurrentUser();
    if (current) {
      user = { displayName: current.displayName, email: current.email, avatarId: current.avatarId };
    }
  } catch {
    user = null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavbar user={user} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
