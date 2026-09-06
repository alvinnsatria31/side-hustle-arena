'use client';

import { useState } from 'react';
import { closeAdminWeek, finalizeAdminWeek, listAdminWeeksClient, useAdminResource, type AdminWeek } from '@/lib/admin-client';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { ArenaApiError } from '@/lib/arena-client';

function jakartaDate(value: string | Date | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

const STATUS_VARIANT: Record<string, 'blue' | 'mint' | 'amber' | 'slate' | 'recommended'> = {
  DRAFT: 'slate',
  PREVIEW: 'slate',
  SCHEDULED: 'slate',
  OPEN: 'blue',
  CLOSED: 'amber',
  FINALIZING: 'amber',
  FINALIZED: 'mint',
  ARCHIVED: 'slate',
  FAILED: 'amber',
};

type Action = { week: AdminWeek; kind: 'close' | 'finalize' };

export default function AdminWeeksPage() {
  const weeks = useAdminResource(() => listAdminWeeksClient({ limit: 50 }));
  const [action, setAction] = useState<Action | null>(null);
  const [force, setForce] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!action) return;
    setPending(true);
    setError(null);
    try {
      if (action.kind === 'close') await closeAdminWeek({ weekId: action.week.id, force });
      else await finalizeAdminWeek(action.week.id);
      setAction(null);
      setForce(false);
      await weeks.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Aksi gagal.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AdminShell title="Minggu" action={<AdminRefreshButton refresh={weeks.refresh} loading={weeks.loading} />}>
      {weeks.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {weeks.error.message}
        </div>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-sk-bg text-xs text-sk-muted">
            <tr>
              <th className="p-4">Kode</th>
              <th className="p-4">Status</th>
              <th className="p-4">Buka</th>
              <th className="p-4">Deadline</th>
              <th className="p-4">Ditutup</th>
              <th className="p-4">Final</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sk-border">
            {weeks.data?.map((week) => (
              <tr key={week.id}>
                <td className="p-4 font-semibold text-sk-navy">{week.weekCode}</td>
                <td className="p-4">
                  <Badge variant={STATUS_VARIANT[week.status] ?? 'slate'}>{week.status}</Badge>
                </td>
                <td className="p-4 text-xs text-sk-muted">{jakartaDate(week.opensAt)}</td>
                <td className="p-4 text-xs text-sk-muted">{jakartaDate(week.submissionDeadlineAt)}</td>
                <td className="p-4 text-xs text-sk-muted">{jakartaDate(week.closedAt)}</td>
                <td className="p-4 text-xs text-sk-muted">{jakartaDate(week.finalizedAt)}</td>
                <td className="p-4 text-right">
                  {week.status === 'OPEN' && (
                    <Button size="sm" variant="ghost" onClick={() => setAction({ week, kind: 'close' })}>
                      Tutup
                    </Button>
                  )}
                  {week.status === 'CLOSED' && (
                    <Button size="sm" onClick={() => setAction({ week, kind: 'finalize' })}>
                      Finalisasi
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {weeks.data?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-sk-muted">
                  Belum ada minggu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={action !== null} onClose={() => setAction(null)} labelledBy="week-action-title">
        <div className="p-7">
          <h3 id="week-action-title" className="mb-2 text-lg font-bold text-sk-navy">
            {action?.kind === 'close' ? `Tutup ${action.week.weekCode}?` : `Finalisasi ${action?.week.weekCode}?`}
          </h3>
          <p className="mb-4 text-sm text-sk-muted">
            {action?.kind === 'close'
              ? 'Menutup submission untuk minggu ini. Peserta tidak bisa submit/resubmit lagi setelah ini.'
              : 'Menghitung ranking, membagikan poin, dan mempublikasikan hasil. Butuh semua review sudah selesai.'}
          </p>
          {action?.kind === 'close' && (
            <label className="mb-4 flex items-center gap-2 text-sm text-sk-body">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-4 w-4" />
              Paksa tutup sebelum deadline tercapai
            </label>
          )}
          {error && <p className="mb-4 text-sm text-sk-error">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setAction(null)} disabled={pending}>
              Batal
            </Button>
            <Button onClick={submit} loading={pending}>
              {action?.kind === 'close' ? 'Tutup minggu' : 'Finalisasi'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
