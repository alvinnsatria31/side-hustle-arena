import { LandingHeader } from '@/components/landing/LandingHeader';
import { Footer } from '@/components/layout/Footer';
import { getAuthConfig } from '@/server/auth/config';
import { getCurrentUser } from '@/server/auth';

/**
 * The public pitch, and only the public pitch.
 *
 * It has its own group because it has its own header: `(public)` wraps the
 * Arena's browsable surfaces — projects, showcase, sign-in — in a bar that
 * lists them, which is right there and wrong on a page whose entire job is to
 * move a stranger through one door. Splitting the layouts is what lets that
 * header be different without touching any other public page.
 *
 * The session is resolved here rather than in the page so that every call to
 * action, header included, agrees on where the door leads. Failing to read it
 * is not a reason to fail the page: a marketing page must render for an
 * anonymous visitor even when the Arena's own secret or storage is not
 * reachable, so a broken session falls back to the signed-out flow.
 */
export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  let signedIn = false;
  try {
    signedIn = (await getCurrentUser()) !== null;
  } catch {
    signedIn = false;
  }

  // Where "Sekolah Karir" points. Same origin the sign-in gate uses, so the
  // header and the login flow can never name two different main sites.
  const mainSiteUrl = getAuthConfig().canonicalOrigin;

  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader signedIn={signedIn} mainSiteUrl={mainSiteUrl} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
