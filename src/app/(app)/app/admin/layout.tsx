import { redirect } from 'next/navigation';
import { requireArenaAdminSession } from '@/server/admin/auth';
import { AdminNav } from '@/components/admin/AdminShell';

/**
 * `(app)/layout.tsx` already forces login before this runs, so a thrown
 * FORBIDDEN here means "logged in, not an admin" — bounce quietly rather than
 * exposing that this section exists to non-admins.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireArenaAdminSession().catch(() => null);
  if (!admin) redirect('/app');

  return (
    <div className="min-h-screen bg-sk-bg">
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <AdminNav scopes={admin.scopes} />
      </div>
      {children}
    </div>
  );
}
