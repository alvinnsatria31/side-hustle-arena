'use client';

import { useCallback, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import {
  closeAdminWeek,
  createAdminWeekClient,
  finalizeAdminWeek,
  generateAdminWeek,
  listAdminWeeksClient,
  publishAdminWeek,
  rescheduleAdminWeekClient,
  useAdminResource,
  type AdminWeek,
} from '@/lib/admin-client';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { ArenaApiError } from '@/lib/arena-client';
import { fromJakartaInput, jakartaDate, toJakartaInput } from '@/lib/jakarta-time';

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

type Kind = 'close' | 'finalize' | 'generate' | 'publish' | 'reschedule';
type Action = { week: AdminWeek; kind: Kind };

const COPY: Record<Kind, { title: string; body: string }> = {
  close: { title: 'Tutup', body: 'Menutup submission untuk minggu ini. Peserta tidak bisa submit/resubmit lagi setelah ini.' },
  finalize: { title: 'Finalisasi', body: 'Menghitung ranking, membagikan poin, dan mempublikasikan hasil. Butuh semua review sudah selesai.' },
  generate: { title: 'Generate project', body: 'Membuat draft project untuk setiap divisi aktif di minggu ini. Tanpa model AI terkonfigurasi, generator hanya memakai library.' },
  publish: { title: 'Publikasikan', body: 'Menerbitkan project yang sudah lolos preview dan membuka minggunya. Project yang belum siap akan ditahan beserta alasannya.' },
  reschedule: { title: 'Ubah jadwal', body: 'Memindahkan waktu buka dan deadline. Minggu yang sudah OPEN hanya bisa mengubah deadline.' },
};

/** WIB working hours for a launch someone typed by hand, not a computed window. */
const DEFAULT_OPEN_HOUR = 'T08:00';
const DEFAULT_DEADLINE_HOUR = 'T23:59';

function isoDatePlus(days: number) {
  const local = new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000);
  return local.toISOString().slice(0, 10);
}

export default function AdminWeeksPage() {
  const weeks = useAdminResource(useCallback(() => listAdminWeeksClient({ limit: 50 }), []));
  const [action, setAction] = useState<Action | null>(null);
  const [force, setForce] = useState(false);
  const [reason, setReason] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [deadlineAt, setDeadlineAt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ weekCode: '', title: '', opensAt: '', submissionDeadlineAt: '', previewAt: '' });

  const openAction = (next: Action) => {
    setAction(next);
    setForce(false);
    setReason('');
    setOpensAt(toJakartaInput(next.week.opensAt));
    setDeadlineAt(toJakartaInput(next.week.submissionDeadlineAt));
    setError(null);
    setOutcome(null);
  };

  const openCreate = () => {
    setDraft({
      weekCode: `ARENA-${isoDatePlus(0)}`,
      title: `Arena ${isoDatePlus(0)}`,
      opensAt: `${isoDatePlus(0)}${DEFAULT_OPEN_HOUR}`,
      submissionDeadlineAt: `${isoDatePlus(4)}${DEFAULT_DEADLINE_HOUR}`,
      previewAt: '',
    });
    setError(null);
    setCreating(true);
  };

  const submit = async () => {
    if (!action) return;
    setPending(true);
    setError(null);
    setOutcome(null);
    try {
      if (action.kind === 'close') await closeAdminWeek({ weekId: action.week.id, force });
      else if (action.kind === 'finalize') await finalizeAdminWeek(action.week.id);
      else if (action.kind === 'generate') {
        const result = await generateAdminWeek({ weekId: action.week.id });
        setOutcome(`Generator (${result.provider}) selesai: ${JSON.stringify(result.results)}`);
      } else if (action.kind === 'publish') {
        const result = await publishAdminWeek(action.week.id);
        setOutcome(result.skipped
          ? `Dilewati: ${result.skipped}`
          : `Terbit: ${result.published.length} project${result.held.length ? `, ditahan ${result.held.length} (${result.held.map((h) => h.reason).join('; ')})` : ''}`);
      } else {
        const opens = fromJakartaInput(opensAt);
        const deadline = fromJakartaInput(deadlineAt);
        if (!deadline) throw new ArenaApiError('VALIDATION_ERROR', 'Deadline tidak valid.', 400);
        await rescheduleAdminWeekClient({
          weekId: action.week.id,
          opensAt: action.week.status === 'OPEN' || !opens ? undefined : opens,
          submissionDeadlineAt: deadline,
          reason,
        });
      }
      await weeks.refresh();
      // Generate and publish report what they did; keep the dialog open for it.
      if (action.kind !== 'generate' && action.kind !== 'publish') setAction(null);
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Aksi gagal.');
    } finally {
      setPending(false);
    }
  };

  const create = async () => {
    setPending(true);
    setError(null);
    const opens = fromJakartaInput(draft.opensAt);
    const deadline = fromJakartaInput(draft.submissionDeadlineAt);
    const preview = draft.previewAt ? fromJakartaInput(draft.previewAt) : null;
    if (!opens || !deadline) {
      setError('Waktu buka dan deadline wajib diisi dengan format yang valid.');
      setPending(false);
      return;
    }
    try {
      await createAdminWeekClient({
        weekCode: draft.weekCode.trim(), title: draft.title.trim(),
        opensAt: opens, submissionDeadlineAt: deadline, previewAt: preview,
      });
      setCreating(false);
      await weeks.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Minggu gagal dibuat.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AdminShell
      title="Minggu"
      action={
        <div className="flex gap-2">
          <Button size="sm" onClick={openCreate} iconLeft={<CalendarPlus size={15} aria-hidden />}>Minggu baru</Button>
          <AdminRefreshButton refresh={weeks.refresh} loading={weeks.loading} />
        </div>
      }
    >
      {weeks.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {weeks.error.message}
        </div>
      )}

      <Card className="mb-6 p-6">
        <PanelHeading>Rilis di luar jadwal</PanelHeading>
        <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-sk-body">
          <li><strong>Minggu baru</strong> dengan waktu buka di hari yang kamu mau, misalnya Selasa 08:00.</li>
          <li><strong>Generate project</strong> pada minggu itu untuk mengisi tiap divisi aktif.</li>
          <li>Di halaman Project, <strong>Setujui</strong> tiap project — persetujuan melewati masa tunggu preview minimum.</li>
          <li><strong>Publikasikan</strong> setelah waktu buka lewat. Minggu berpindah ke OPEN dan peserta bisa mulai.</li>
        </ol>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-left text-sm">
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
            {weeks.data?.map((week) => {
              const draftable = ['DRAFT', 'PREVIEW', 'SCHEDULED'].includes(week.status);
              return (
                <tr key={week.id}>
                  <td className="p-4 font-semibold text-sk-navy">{week.weekCode}</td>
                  <td className="p-4">
                    <Badge variant={STATUS_VARIANT[week.status] ?? 'slate'}>{week.status}</Badge>
                  </td>
                  <td className="p-4 text-xs text-sk-muted">{jakartaDate(week.opensAt)}</td>
                  <td className="p-4 text-xs text-sk-muted">{jakartaDate(week.submissionDeadlineAt)}</td>
                  <td className="p-4 text-xs text-sk-muted">{jakartaDate(week.closedAt)}</td>
                  <td className="p-4 text-xs text-sk-muted">{jakartaDate(week.finalizedAt)}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {draftable && <Button size="sm" variant="ghost" onClick={() => openAction({ week, kind: 'generate' })}>Generate</Button>}
                      {draftable && <Button size="sm" onClick={() => openAction({ week, kind: 'publish' })}>Publikasikan</Button>}
                      {(draftable || week.status === 'OPEN') && (
                        <Button size="sm" variant="ghost" onClick={() => openAction({ week, kind: 'reschedule' })}>Jadwal</Button>
                      )}
                      {week.status === 'OPEN' && <Button size="sm" variant="ghost" onClick={() => openAction({ week, kind: 'close' })}>Tutup</Button>}
                      {week.status === 'CLOSED' && <Button size="sm" onClick={() => openAction({ week, kind: 'finalize' })}>Finalisasi</Button>}
                    </div>
                  </td>
                </tr>
              );
            })}
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
            {action ? `${COPY[action.kind].title} ${action.week.weekCode}?` : ''}
          </h3>
          <p className="mb-4 text-sm text-sk-muted">{action ? COPY[action.kind].body : ''}</p>

          {action?.kind === 'close' && (
            <label className="mb-4 flex items-center gap-2 text-[13px] font-medium text-sk-body">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              Paksa tutup walau deadline belum lewat
            </label>
          )}

          {action?.kind === 'reschedule' && (
            <>
              <label className="mb-4 block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Waktu buka (WIB)</span>
                <Input type="datetime-local" value={opensAt} disabled={action.week.status === 'OPEN'}
                  onChange={(e) => setOpensAt(e.target.value)} />
                {action.week.status === 'OPEN' && (
                  <span className="mt-1.5 block text-[11.5px] text-sk-muted">Minggu sudah dibuka, waktu buka terkunci.</span>
                )}
              </label>
              <label className="mb-4 block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Deadline submission (WIB)</span>
                <Input type="datetime-local" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} />
              </label>
              <label className="mb-4 block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Alasan (tercatat di audit log)</span>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            </>
          )}

          {outcome && (
            <pre className="mb-4 max-h-52 overflow-auto rounded-[var(--radius-sk)] bg-sk-bg p-3 font-mono text-[11px] leading-relaxed text-sk-body">
              {outcome}
            </pre>
          )}
          {error && <p role="alert" className="mb-4 text-sm text-sk-error">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAction(null)}>Tutup</Button>
            <Button loading={pending} disabled={action?.kind === 'reschedule' && !reason.trim()} onClick={submit}>
              {action ? COPY[action.kind].title : ''}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} labelledBy="week-create-title">
        <div className="p-7">
          <h3 id="week-create-title" className="mb-2 text-lg font-bold text-sk-navy">Minggu baru</h3>
          <p className="mb-4 text-sm text-sk-muted">
            Dibuat dengan status DRAFT dan aturan default. Isi waktu buka sesuai hari rilis yang kamu mau.
          </p>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Kode minggu</span>
            <Input value={draft.weekCode} onChange={(e) => setDraft({ ...draft, weekCode: e.target.value })} />
          </label>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Judul</span>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Waktu buka (WIB)</span>
            <Input type="datetime-local" value={draft.opensAt} onChange={(e) => setDraft({ ...draft, opensAt: e.target.value })} />
          </label>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Deadline submission (WIB)</span>
            <Input type="datetime-local" value={draft.submissionDeadlineAt} onChange={(e) => setDraft({ ...draft, submissionDeadlineAt: e.target.value })} />
          </label>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Waktu preview (WIB, opsional)</span>
            <Input type="datetime-local" value={draft.previewAt} onChange={(e) => setDraft({ ...draft, previewAt: e.target.value })} />
          </label>

          {error && <p role="alert" className="mb-4 text-sm text-sk-error">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>Batal</Button>
            <Button loading={pending} disabled={!draft.weekCode.trim() || !draft.title.trim()} onClick={create}>Buat</Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
