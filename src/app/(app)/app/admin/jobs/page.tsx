'use client';

import { useCallback, useState } from 'react';
import { Play } from 'lucide-react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { getAdminJobs, runAdminJobClient, useAdminResource, type AdminJobResult } from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';
import { jakartaDate } from '@/lib/jakarta-time';

/**
 * Manual automation.
 *
 * These are the same jobs `n8n/arena-trigger-workflow.json` calls on a timer.
 * Running one here does not skip a schedule or bypass a guard — every job
 * still finds its own work and reports `skipped` when there is none, which is
 * why an impatient second click is harmless.
 */
export default function AdminJobsPage() {
  const catalogue = useAdminResource(useCallback(() => getAdminJobs(), []));
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, AdminJobResult | { failed: string }>>({});

  const run = async (job: string) => {
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
    <AdminShell title="Otomasi" action={<AdminRefreshButton refresh={catalogue.refresh} loading={catalogue.loading} />}>
      {catalogue.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {catalogue.error.message}
        </div>
      )}

      <p className="mb-6 text-sm text-sk-muted">
        Job yang sama dengan yang dipanggil n8n tiap beberapa menit. Menjalankan manual di sini tidak melewati
        pengaman apa pun — job yang belum ada kerjaannya akan melaporkan <code className="font-mono text-xs">skipped</code>,
        bukan error. Aman diklik dua kali.
      </p>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {catalogue.data?.jobs.map(({ job, label, detail, scope }) => {
          const result = results[job];
          return (
            <Card key={job} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-sk-navy">{label}</h3>
                  <p className="font-mono text-[11px] text-sk-muted">{job}</p>
                </div>
                <Badge variant="slate">{scope}</Badge>
              </div>
              <p className="flex-1 text-[13px] leading-relaxed text-sk-body">{detail}</p>

              {result && (
                <pre className="max-h-52 overflow-auto rounded-[var(--radius-sk)] bg-sk-bg p-3 font-mono text-[11px] leading-relaxed text-sk-body">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}

              <div>
                <Button size="sm" loading={running === job} disabled={running !== null}
                  onClick={() => run(job)} iconLeft={<Play size={14} aria-hidden />}>
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
