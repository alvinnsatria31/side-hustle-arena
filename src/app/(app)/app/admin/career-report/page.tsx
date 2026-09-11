import { redirect } from 'next/navigation';
import { requireArenaAdminSession } from '@/server/admin/auth';
import { AdminCareerReportConsole } from '@/components/admin/AdminCareerReportConsole';

export const dynamic = 'force-dynamic';

/**
 * Career Report operations.
 *
 * The report itself is still never stored: `getCareerReport()` derives it on
 * the fly from the participant overview, the latest CV and the skill taxonomy.
 * What an operator needs is a way in — which participants have a report worth
 * reading, what it says at a glance, and the report itself when a participant
 * complains that it is wrong. Both read the same sources the participant's page
 * reads, so the admin never sees a different number than the participant does.
 *
 * Gated on `users`, not `overview`: the list carries emails and CV status, and
 * the preview carries CV claims.
 */
export default async function AdminCareerReportPage() {
  const admin = await requireArenaAdminSession();
  if (!admin.scopes.includes('users')) redirect('/app/admin');
  return <AdminCareerReportConsole />;
}
