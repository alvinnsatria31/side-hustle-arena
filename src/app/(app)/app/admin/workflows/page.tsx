import { redirect } from 'next/navigation';
import { requireArenaAdminSession } from '@/server/admin/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { TriggerWorkflow } from '@/components/admin/TriggerWorkflow';

export default async function AdminWorkflowsPage() {
  const admin = await requireArenaAdminSession();
  if (!admin.scopes.includes('projects')) redirect('/app/admin');
  return <AdminShell title="Trigger Workflow" description="Jalankan rilis project manual kapan diperlukan, dengan jadwal mingguan tetap berjalan.">
    <TriggerWorkflow />
  </AdminShell>;
}
