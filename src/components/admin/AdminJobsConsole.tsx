'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Check, Play, TriangleAlert, X } from 'lucide-react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { AddJobSourceDialog } from '@/components/admin/AddJobSourceDialog';
import {
  getAdminJobs,
  runAdminJobClient,
  useAdminResource,
  type AdminJobResult,
} from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';
import { jakartaDate } from '@/lib/jakarta-time';

/**
 * Scheduled operations, configuration readiness, and the off-schedule release.
 *
 * `release` arrives from the server page already gated on the `projects` scope.
 * Rendering it as a slot rather than reading the scope here keeps this a Client
 * Component — it needs local state for the run buttons — without teaching it
 * anything about permissions.
 */
export function AdminJobsConsole({ release, canManageSources = false }: { release?: ReactNode; canManageSources?: boolean }) {
  const catalogue = useAdminResource(useCallback(() => getAdminJobs(), []));
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, AdminJobResult | { failed: string }>>({});

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

      {release && <div className="mb-7">{release}</div>}

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

              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" loading={running === job} disabled={running !== null}
                  onClick={() => runJob(job)} iconLeft={<Play size={14} aria-hidden />}>
                  Jalankan sekarang
                </Button>
                {/* The sync job has nothing to pull until a source exists; register one right here. */}
                {job === 'jobs-sync' && canManageSources && (
                  <>
                    <AddJobSourceDialog variant="ghost" onCreated={() => catalogue.refresh()} />
                    <ButtonLink size="sm" variant="ghost" href="/app/admin/careers">Kelola sumber</ButtonLink>
                  </>
                )}
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
