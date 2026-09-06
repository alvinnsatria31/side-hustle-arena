'use client';

import { useCallback, useState } from 'react';
import { Check, Play, Rocket, TriangleAlert, X } from 'lucide-react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import {
  getAdminJobs,
  launchAdminProjectRun,
  runAdminJobClient,
  useAdminResource,
  type AdminJobResult,
  type AdminLaunchResult,
} from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';
import { fromJakartaInput, jakartaDate } from '@/lib/jakarta-time';

function wibDefault(dayOffset: number, time: string) {
  const local = new Date(Date.now() + 7 * 3_600_000 + dayOffset * 86_400_000);
  return `${local.toISOString().slice(0, 10)}T${time}`;
}

/**
 * The automation hub.
 *
 * Two different things live here on purpose. The release panel is the one an
 * operator reaches for — "we need a project live on Tuesday" — and the job
 * grid below is the machinery n8n drives on a timer, exposed so the same
 * person can run a tick by hand when they are not willing to wait for one.
 */
export default function AdminJobsPage() {
  const catalogue = useAdminResource(useCallback(() => getAdminJobs(), []));
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, AdminJobResult | { failed: string }>>({});

  const [launch, setLaunch] = useState({
    opensAt: wibDefault(0, '08:00'),
    submissionDeadlineAt: wibDefault(4, '23:59'),
    title: '',
    reason: '',
    approve: true,
    publish: true,
  });
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<AdminLaunchResult | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const readiness = catalogue.data?.readiness;

  const runJob = async (job: string) => {
    setRunning(job);
    try {
      const result = await runAdminJobClient(job);
      setResults((prev) => ({ ...prev, [job]: result }));
      await catalogue.refresh();
    } catch (error) {
      setResults((prev) => ({ ...prev, [job]: { failed: error instanceof ArenaApiError ? error.message : 'Job gagal dijalankan.' } }));
    } finally {
      setRunning(null);
    }
  };

  const submitLaunch = async () => {
    setLaunching(true);
    setLaunchError(null);
    setLaunchResult(null);
    const opensAt = fromJakartaInput(launch.opensAt);
    const submissionDeadlineAt = fromJakartaInput(launch.submissionDeadlineAt);
    if (!opensAt || !submissionDeadlineAt) {
      setLaunchError('Waktu buka dan deadline harus diisi dengan format yang valid.');
      setLaunching(false);
      return;
    }
    try {
      setLaunchResult(await launchAdminProjectRun({
        opensAt,
        submissionDeadlineAt,
        title: launch.title.trim() || undefined,
        approve: launch.approve,
        publish: launch.publish,
        reason: launch.reason,
      }));
      await catalogue.refresh();
    } catch (error) {
      setLaunchError(error instanceof ArenaApiError ? error.message : 'Rilis gagal dijalankan.');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <AdminShell
      title="Otomasi"
      description="Rilis project di luar siklus Senin, dan jalankan job terjadwal yang biasanya dipicu n8n."
      action={<AdminRefreshButton refresh={catalogue.refresh} loading={catalogue.loading} />}
    >
      {catalogue.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {catalogue.error.message}
        </div>
      )}

      {readiness?.configError && (
        <div role="alert" className="mb-5 flex gap-2.5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>Konfigurasi generasi tidak valid: {readiness.configError}</span>
        </div>
      )}

      {readiness && (
        <Card className="mb-7 p-6">
          <PanelHeading>Kesiapan produksi</PanelHeading>
          <p className="mb-4 text-[13px] leading-relaxed text-sk-body">
            Yang belum tercentang harus diisi di environment variable Vercel. Konsol hanya melaporkan
            terisi atau tidak — nilainya tidak pernah dikirim ke browser.
          </p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {readiness.config.map((item) => (
              <li key={item.key} className="flex gap-2.5">
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                    item.set ? 'bg-sk-mint text-sk-navy' : 'bg-sk-bg text-sk-muted'
                  }`}
                >
                  {item.set ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[11.5px] font-semibold text-sk-navy">{item.key}</span>
                  <span className="block text-[12px] leading-relaxed text-sk-muted">{item.purpose}</span>
                  <span className="sr-only">{item.set ? 'sudah diisi' : 'belum diisi'}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-7 p-6">
        <PanelHeading>Rilis project di luar jadwal</PanelHeading>
        <p className="mb-5 text-[13px] leading-relaxed text-sk-body">
          Membuat minggu baru, menjalankan generator untuk setiap divisi aktif, lalu—kalau kamu centang—menyetujui
          dan mempublikasikannya. Ini jalur yang sama yang dipanggil workflow n8n{' '}
          <code className="font-mono text-xs">arena-adhoc-launch</code>, hanya saja dijalankan olehmu langsung.
        </p>

        <div className="mb-4 flex flex-wrap gap-2 text-[11.5px]">
          <Badge variant={readiness?.generationProvider ? 'mint' : 'amber'}>
            Generator: {readiness?.generationProvider ?? 'library-only'}
          </Badge>
          <Badge variant={readiness?.reviewProvider ? 'mint' : 'amber'}>
            Review AI: {readiness?.reviewProvider ?? 'belum dikonfigurasi'}
          </Badge>
          {readiness?.previewHours != null && <Badge variant="slate">Preview minimum: {readiness.previewHours} jam</Badge>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Waktu buka (WIB)</span>
            <Input type="datetime-local" value={launch.opensAt} onChange={(e) => setLaunch({ ...launch, opensAt: e.target.value })} />
            <span className="mt-1.5 block text-[11.5px] text-sk-muted">
              Publikasi hanya jalan kalau waktu ini sudah lewat. Untuk rilis Selasa, isi Selasa lalu publikasikan pada harinya.
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Deadline submission (WIB)</span>
            <Input type="datetime-local" value={launch.submissionDeadlineAt} onChange={(e) => setLaunch({ ...launch, submissionDeadlineAt: e.target.value })} />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Judul minggu (opsional)</span>
          <Input value={launch.title} onChange={(e) => setLaunch({ ...launch, title: e.target.value })} placeholder="Rilis khusus — sprint kolaborasi" />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Alasan (tercatat di audit log)</span>
          <Textarea rows={2} value={launch.reason} onChange={(e) => setLaunch({ ...launch, reason: e.target.value })} />
        </label>

        <div className="mt-4 flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-[13px] font-medium text-sk-body">
            <input type="checkbox" checked={launch.approve} onChange={(e) => setLaunch({ ...launch, approve: e.target.checked })} />
            Setujui otomatis
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-sk-body">
            <input type="checkbox" checked={launch.publish} onChange={(e) => setLaunch({ ...launch, publish: e.target.checked })} />
            Langsung publikasikan
          </label>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-sk-muted">
          Setujui otomatis melewati masa tunggu preview minimum — artinya tidak ada manusia yang membaca hasil AI
          sebelum peserta melihatnya. Matikan kalau kamu mau review dulu di halaman Project.
        </p>

        {launchError && <p role="alert" className="mt-4 text-sm text-sk-error">{launchError}</p>}

        {launchResult && (
          <div className="mt-4 rounded-[var(--radius-sk)] border border-sk-border bg-sk-bg p-4">
            <p className="mb-2 text-[13px] font-bold text-sk-navy">
              {launchResult.weekCode} {launchResult.created ? '(minggu baru dibuat)' : '(minggu dipakai ulang)'}
            </p>
            <ul className="space-y-2">
              {launchResult.steps.map((step) => (
                <li key={step.step} className="text-[12.5px]">
                  <Badge variant={step.ok ? 'mint' : 'amber'}>{step.step}</Badge>
                  <pre className="mt-1 overflow-x-auto font-mono text-[11px] leading-relaxed text-sk-body">
                    {JSON.stringify(step.detail, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <Button loading={launching} disabled={!launch.reason.trim()} onClick={submitLaunch} iconLeft={<Rocket size={15} aria-hidden />}>
            Rilis sekarang
          </Button>
        </div>
      </Card>

      <h2 className="mb-1 text-lg font-bold text-sk-navy">Job terjadwal</h2>
      <p className="mb-5 text-sm text-sk-muted">
        Job yang sama dengan yang dipanggil n8n. Menjalankan manual tidak melewati pengaman apa pun — job yang
        belum ada kerjaannya melaporkan <code className="font-mono text-xs">skipped</code>, bukan error.
      </p>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {catalogue.data?.jobs.map(({ job, label, detail, scope, inert }) => {
          const result = results[job];
          return (
            <Card key={job} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-sk-navy">{label}</h3>
                  <p className="font-mono text-[11px] text-sk-muted">{job}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {inert && <Badge variant="amber">Nonaktif</Badge>}
                  <Badge variant="slate">{scope}</Badge>
                </div>
              </div>
              <p className="text-[13px] leading-relaxed text-sk-body">{detail}</p>
              {inert && (
                <p className="rounded-[var(--radius-sk)] bg-sk-bg p-3 text-[12px] leading-relaxed text-sk-muted">{inert}</p>
              )}

              {result && (
                <pre className="max-h-52 overflow-auto rounded-[var(--radius-sk)] bg-sk-bg p-3 font-mono text-[11px] leading-relaxed text-sk-body">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}

              <div className="mt-auto">
                <Button size="sm" loading={running === job} disabled={running !== null}
                  onClick={() => runJob(job)} iconLeft={<Play size={14} aria-hidden />}>
                  Jalankan sekarang
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="p-6 pb-3">
          <PanelHeading>Riwayat Automation Run</PanelHeading>
        </div>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-sk-bg text-xs text-sk-muted">
            <tr>
              <th className="p-4">Tipe</th>
              <th className="p-4">Status</th>
              <th className="p-4">Mulai</th>
              <th className="p-4">Selesai</th>
              <th className="p-4 text-right">Item</th>
              <th className="p-4">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sk-border">
            {catalogue.data?.runs.map((run) => (
              <tr key={run.id}>
                <td className="p-4 font-semibold text-sk-navy">{run.type}</td>
                <td className="p-4"><Badge variant={run.status === 'SUCCESS' ? 'mint' : run.status === 'FAILED' ? 'amber' : 'slate'}>{run.status}</Badge></td>
                <td className="p-4 text-xs text-sk-muted">{jakartaDate(run.startedAt)}</td>
                <td className="p-4 text-xs text-sk-muted">{jakartaDate(run.completedAt)}</td>
                <td className="p-4 text-right text-xs tabular-nums text-sk-body">{run.itemsSuccess}/{run.itemsTotal}{run.itemsFailed > 0 ? ` (${run.itemsFailed} gagal)` : ''}</td>
                <td className="p-4 text-xs text-sk-muted">{run.errorSummary ?? '—'}</td>
              </tr>
            ))}
            {catalogue.data?.runs.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-sm text-sk-muted">Belum ada automation run.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
