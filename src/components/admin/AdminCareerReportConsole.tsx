'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { Eye, Search } from 'lucide-react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Modal } from '@/components/primitives/Modal';
import {
  listAdminCareerReportsClient,
  previewAdminCareerReportClient,
  useAdminResource,
  type AdminCareerReportPreview,
  type AdminCareerReportRow,
} from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';
import { jakartaDate } from '@/lib/jakarta-time';

const PAGE = 25;

const score = (value: number | null) => (value === null ? '—' : `${value}/100`);

/**
 * Career Report, operationally: who has a report worth reading, what it says
 * in one line, and the report itself one click away for answering a complaint.
 * Nothing here is stored — the summary is computed from the same sources as
 * the participant's page, and a preview is that page's data, read and audited.
 */
export function AdminCareerReportConsole() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const list = useAdminResource(useCallback(() => listAdminCareerReportsClient({ q: search, limit: PAGE, offset }), [search, offset]));

  const [previewing, setPreviewing] = useState<AdminCareerReportRow | null>(null);
  const [preview, setPreview] = useState<AdminCareerReportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const openPreview = async (row: AdminCareerReportRow) => {
    setPreviewing(row);
    setPreview(null);
    setPreviewError(null);
    try {
      setPreview(await previewAdminCareerReportClient(row.id));
    } catch (err) {
      setPreviewError(err instanceof ArenaApiError ? err.message : 'Laporan belum bisa dimuat.');
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setOffset(0);
    setSearch(q.trim());
  };

  const rows = list.data ?? [];

  return (
    <AdminShell
      title="Career Report"
      description="Ringkasan laporan karir tiap peserta dan pratinjau laporan persis seperti yang mereka lihat — untuk audit dan menjawab komplain."
      action={<AdminRefreshButton refresh={list.refresh} loading={list.loading} />}
    >
      <form onSubmit={submit} className="mb-5 flex max-w-xl gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, email, atau subject" aria-label="Cari peserta" />
        <Button type="submit" variant="ghost" iconLeft={<Search size={15} aria-hidden />}>Cari</Button>
      </form>

      {list.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">{list.error.message}</div>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-sk-bg text-xs text-sk-muted">
            <tr>
              <th className="p-4">Peserta</th>
              <th className="p-4 text-right">Project selesai</th>
              <th className="p-4 text-right">Rata-rata skor project</th>
              <th className="p-4 text-right">Rata-rata skor skill</th>
              <th className="p-4">CV terakhir</th>
              <th className="p-4 text-right">Poin</th>
              <th className="p-4"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sk-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="p-4">
                  <div className="font-semibold text-sk-navy">{row.name ?? row.authSubject}</div>
                  <div className="break-all text-xs text-sk-muted">{row.email ?? row.authSubject}</div>
                  {row.status !== 'ACTIVE' && <Badge variant="amber" className="mt-1">{row.status}</Badge>}
                </td>
                <td className="p-4 text-right tabular-nums">
                  {row.projectsCompleted}
                  <span className="block text-xs text-sk-muted">dari {row.enrollments} diikuti</span>
                </td>
                <td className="p-4 text-right tabular-nums">{score(row.averageScore)}</td>
                <td className="p-4 text-right tabular-nums">
                  {score(row.skillScoreAverage)}
                  <span className="block text-xs text-sk-muted">
                    {row.measuredSkills} terukur{row.evidencedSkills > row.measuredSkills ? ` · ${row.evidencedSkills - row.measuredSkills} hanya skor project` : ''}
                  </span>
                </td>
                <td className="p-4">
                  {row.cv
                    ? <>
                      <div className="font-semibold text-sk-navy">{row.cv.score === null ? '—' : `${row.cv.score}/100`}{row.cv.statusLabel ? ` · ${row.cv.statusLabel}` : ''}</div>
                      <div className="text-xs text-sk-muted">{jakartaDate(row.cv.scannedAt)}</div>
                    </>
                    : <span className="text-xs text-sk-muted">Belum pernah scan</span>}
                </td>
                <td className="p-4 text-right tabular-nums">
                  {row.points.lifetimeEarned.toLocaleString('id-ID')}
                  <span className="block text-xs text-sk-muted">saldo {row.points.balance.toLocaleString('id-ID')}</span>
                </td>
                <td className="p-4 text-right">
                  <Button size="sm" variant="ghost" iconLeft={<Eye size={14} aria-hidden />} onClick={() => void openPreview(row)}>
                    Pratinjau Laporan
                  </Button>
                </td>
              </tr>
            ))}
            {!list.loading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-sk-muted">
                {search ? 'Tidak ada peserta yang cocok.' : 'Belum ada peserta dengan aktivitas Arena atau scan CV.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-sk-muted">
        <span>{rows.length ? `Menampilkan ${offset + 1}–${offset + rows.length}` : ''}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" disabled={offset === 0 || list.loading} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Sebelumnya</Button>
          <Button size="sm" variant="ghost" disabled={rows.length < PAGE || list.loading} onClick={() => setOffset(offset + PAGE)}>Berikutnya</Button>
        </div>
      </div>

      <Modal open={previewing !== null} onClose={() => setPreviewing(null)} labelledBy="career-preview-title" className="max-w-3xl">
        <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-7">
          <h3 id="career-preview-title" className="pr-10 text-lg font-bold text-sk-navy">
            Career Report — {previewing?.name ?? previewing?.authSubject}
          </h3>
          <p className="mb-5 mt-1 text-xs text-sk-muted">
            Data yang sama dengan halaman Career Report peserta. Pratinjau ini tercatat di audit log.
          </p>
          {previewError && <p role="alert" className="text-sm text-sk-error">{previewError}</p>}
          {!preview && !previewError && <p role="status" className="text-sm text-sk-muted">Memuat laporan…</p>}
          {preview && <ReportBody preview={preview} />}
        </div>
      </Modal>
    </AdminShell>
  );
}

function ReportBody({ preview }: { preview: AdminCareerReportPreview }) {
  const { report } = preview;
  return (
    <div className="grid gap-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Project selesai', value: report.projectsCompleted },
          { label: 'Skill terbukti', value: report.skills.length },
          { label: 'Skor rata-rata', value: score(report.averageScore) },
          { label: 'Poin tersedia', value: report.points.balance.toLocaleString('id-ID') },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-sk-border p-3">
            <dt className="text-xs text-sk-muted">{stat.label}</dt>
            <dd className="mt-1 text-xl font-extrabold text-sk-navy">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h4 className="mb-2 text-sm font-bold text-sk-navy">Peta skill</h4>
        {report.skills.length === 0
          ? <p className="text-sm text-sk-muted">Belum ada bukti skill dari hasil yang sudah difinalisasi.</p>
          : <ul className="divide-y divide-sk-border">
            {report.skills.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold text-sk-navy">{skill.name}</span>
                <span className="text-right text-xs text-sk-muted">
                  {skill.score === null
                    ? `Belum diukur per skill${skill.projectScore !== null ? ` (skor project ${skill.projectScore}/100)` : ''}`
                    : <><span className="font-mono text-sm text-sk-blue">{skill.score}/100</span> · {skill.measuredCount} review</>}
                </span>
              </li>
            ))}
          </ul>}
      </section>

      <section>
        <h4 className="mb-2 text-sm font-bold text-sk-navy">CV</h4>
        {report.cv
          ? <>
            <p className="text-sm text-sk-body">
              Skor {report.cv.score}/100 · {report.cv.statusLabel} · {report.cv.fileName}, dianalisis {jakartaDate(report.cv.analyzedAt)}.
              {' '}{report.cv.corroborated} klaim sudah ada bukti Arena, {report.cv.unevidenced} belum.
            </p>
            {report.cv.claimedSkills.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {report.cv.claimedSkills.map((claim) => (
                  <li key={claim.name}>
                    <Badge variant={claim.evidenceCount > 0 ? 'mint' : 'slate'}>{claim.name} · {claim.level}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </>
          : <p className="text-sm text-sk-muted">Belum ada scan CV tersimpan.</p>}
      </section>

      <section>
        <h4 className="mb-2 text-sm font-bold text-sk-navy">Riwayat project</h4>
        {report.history.length === 0
          ? <p className="text-sm text-sk-muted">Belum ada project yang selesai difinalisasi.</p>
          : <ol className="divide-y divide-sk-border">
            {report.history.map((item) => (
              <li key={item.id} className="flex gap-3 py-2.5 text-sm">
                <span className="w-10 shrink-0 font-mono font-bold text-sk-blue">{item.score}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sk-navy">{item.title}</p>
                  <p className="text-xs text-sk-muted">{item.category} · {item.weekCode} · Peringkat #{item.rank}{item.skills.length ? ` · ${item.skills.join(', ')}` : ''}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-sk-success">+{item.pointsAwarded}</span>
              </li>
            ))}
          </ol>}
      </section>
    </div>
  );
}
