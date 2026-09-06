'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import {
  listAdminProjectsClient,
  reviewAdminProject,
  scheduleAdminProject,
  useAdminResource,
  type AdminProjectRow,
} from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';
import { fromJakartaInput, jakartaDate, toJakartaInput } from '@/lib/jakarta-time';

const STATUS_VARIANT: Record<string, 'blue' | 'mint' | 'amber' | 'slate'> = {
  DRAFT: 'slate', PREVIEWED: 'blue', SCHEDULED: 'blue',
  PUBLISHED: 'mint', REJECTED: 'amber', ARCHIVED: 'slate',
};

type Pending =
  | { kind: 'approve' | 'veto' | 'regenerate'; project: AdminProjectRow }
  | { kind: 'schedule'; project: AdminProjectRow };

const TITLES = {
  approve: 'Setujui project',
  veto: 'Veto project',
  regenerate: 'Minta generate ulang',
  schedule: 'Jadwalkan publikasi',
} as const;

export default function AdminProjectsPage() {
  const [status, setStatus] = useState('');
  const loader = useCallback(() => listAdminProjectsClient({ status: status || undefined, limit: 100 }), [status]);
  const projects = useAdminResource(loader);

  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (next: Pending) => {
    setPending(next);
    setReason('');
    setScheduleAt(toJakartaInput(next.project.scheduledPublishAt ?? next.project.weekOpensAt));
    setError(null);
  };

  const submit = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'schedule') {
        const instant = scheduleAt ? fromJakartaInput(scheduleAt) : null;
        if (scheduleAt && !instant) throw new ArenaApiError('VALIDATION_ERROR', 'Waktu publikasi tidak valid.', 400);
        await scheduleAdminProject({ projectId: pending.project.id, scheduledPublishAt: instant, reason });
      } else {
        await reviewAdminProject({ projectId: pending.project.id, action: pending.kind, reason });
      }
      setPending(null);
      await projects.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Aksi gagal.');
    } finally {
      setBusy(false);
    }
  };

  const statuses = useMemo(() => ['', 'DRAFT', 'PREVIEWED', 'SCHEDULED', 'PUBLISHED', 'REJECTED', 'ARCHIVED'], []);

  return (
    <AdminShell title="Project" action={<AdminRefreshButton refresh={projects.refresh} loading={projects.loading} />}>
      {projects.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {projects.error.message}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {statuses.map((value) => (
          <button
            key={value || 'ALL'}
            onClick={() => setStatus(value)}
            aria-pressed={status === value}
            className={`rounded-[var(--radius-sk)] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              status === value ? 'border-sk-blue bg-sk-blue-tint text-sk-blue' : 'border-sk-border text-sk-muted hover:text-sk-navy'
            }`}
          >
            {value || 'Semua'}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-sk-bg text-xs text-sk-muted">
            <tr>
              <th className="p-4">Project</th>
              <th className="p-4">Minggu</th>
              <th className="p-4">Divisi</th>
              <th className="p-4">Status</th>
              <th className="p-4">Terbit</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sk-border">
            {projects.data?.map((project) => {
              const editable = !['PUBLISHED', 'ARCHIVED'].includes(project.status);
              return (
                <tr key={project.id}>
                  <td className="p-4">
                    <Link href={`/app/admin/projects/${project.id}`} className="font-semibold text-sk-blue hover:underline">
                      {project.title}
                    </Link>
                    <p className="font-mono text-[11px] text-sk-muted">{project.slug}</p>
                  </td>
                  <td className="p-4 text-xs text-sk-muted">
                    {project.weekCode}
                    <span className="block">{project.weekStatus}</span>
                  </td>
                  <td className="p-4 text-xs text-sk-body">{project.divisionName}</td>
                  <td className="p-4">
                    <Badge variant={STATUS_VARIANT[project.status] ?? 'slate'}>{project.status}</Badge>
                    <span className="mt-1 block font-mono text-[10.5px] text-sk-muted">{project.previewStatus}</span>
                  </td>
                  <td className="p-4 text-xs text-sk-muted">
                    {project.publishedAt ? jakartaDate(project.publishedAt) : jakartaDate(project.scheduledPublishAt)}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {editable && <Button size="sm" onClick={() => open({ kind: 'approve', project })}>Setujui</Button>}
                      {editable && <Button size="sm" variant="ghost" onClick={() => open({ kind: 'schedule', project })}>Jadwal</Button>}
                      {editable && <Button size="sm" variant="ghost" onClick={() => open({ kind: 'regenerate', project })}>Ulang</Button>}
                      {editable && <Button size="sm" variant="ghost" onClick={() => open({ kind: 'veto', project })}>Veto</Button>}
                      {!editable && <span className="text-xs text-sk-muted">Terkunci</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {projects.data?.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-sm text-sk-muted">Belum ada project untuk filter ini.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={pending !== null} onClose={() => setPending(null)} labelledBy="project-action-title">
        <div className="p-7">
          <h3 id="project-action-title" className="mb-1 text-lg font-bold text-sk-navy">
            {pending ? TITLES[pending.kind] : ''}
          </h3>
          <p className="mb-4 text-sm text-sk-muted">{pending?.project.title}</p>

          {pending?.kind === 'approve' && (
            <p className="mb-4 rounded-[var(--radius-sk)] bg-sk-blue-wash p-3 text-[12.5px] leading-relaxed text-sk-body">
              Menyetujui project juga melewati masa tunggu preview minimum. Ini jalur yang dipakai kalau kamu mau
              rilis di hari yang sama.
            </p>
          )}

          {pending?.kind === 'schedule' && (
            <label className="mb-4 block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Waktu publikasi (WIB)</span>
              <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
              <span className="mt-1.5 block text-[11.5px] text-sk-muted">
                Kosongkan untuk mencabut jadwal. Harus sebelum deadline submission minggunya.
              </span>
            </label>
          )}

          <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Alasan (tercatat di audit log)</span>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kenapa aksi ini dilakukan?" />
          </label>

          {error && <p role="alert" className="mb-4 text-sm text-sk-error">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>Batal</Button>
            <Button loading={busy} disabled={!reason.trim()} onClick={submit}>Konfirmasi</Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
