import { requireArenaAdminSession } from '@/server/admin/auth';
import { AdminJobsConsole } from '@/components/admin/AdminJobsConsole';
import { TriggerWorkflow } from '@/components/admin/TriggerWorkflow';

export const dynamic = 'force-dynamic';

/**
 * Otomasi absorbed the old Trigger Workflow menu.
 *
 * The two pages did the same errand — make something run now — and splitting
 * them made an operator guess which one they needed. Merging them costs one
 * thing worth stating: `workflows` was gated on the `projects` scope for the
 * whole page, while this one is gated on `overview`. So the release form is
 * rendered only when `projects` is present, rather than showing every admin a
 * form the server would refuse. Without that check the merge would be a quiet
 * regression from a page-level guard to none at all.
 */
export default async function AdminJobsPage() {
  const admin = await requireArenaAdminSession();
  const canRelease = admin.scopes.includes('projects');
  // Same rule as the release form: only offer what the server will accept.
  const canManageSources = admin.scopes.includes('careers');

  return <AdminJobsConsole release={canRelease ? <TriggerWorkflow /> : null} canManageSources={canManageSources} />;
}
