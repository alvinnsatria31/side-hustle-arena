import { redirect } from 'next/navigation';
import { requireArenaAdminSession } from '@/server/admin/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

/**
 * `(app)/layout.tsx` already forces login before this runs, so a thrown
 * FORBIDDEN here means "logged in, not an admin" — bounce quietly rather than
 * exposing that this section exists to non-admins.
 *
 * The console is a rail plus a canvas, and deliberately drops the participant
 * navbar: `AppChrome` hides it under `/app/admin`. An operations screen and a
 * participant screen are different jobs, and stacking both chromes left the
 * real navigation competing with a menu that goes nowhere useful here.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireArenaAdminSession().catch(() => null);
  if (!admin) redirect('/app');

  return (
    <div className="flex min-h-screen flex-col bg-sk-bg md:flex-row">
      <AdminSidebar subject={admin.actorSubject} scopes={admin.scopes} />
      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
