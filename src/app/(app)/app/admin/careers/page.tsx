'use client';

import { useCallback, useState } from 'react';
import { Play, Power, TriangleAlert } from 'lucide-react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { getAdminJobSources, runAdminJobSourceAction, useAdminResource, type AdminJobSource } from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';
import { jakartaDate } from '@/lib/jakarta-time';

const HEALTH: Record<string, { label: string; variant: 'mint' | 'amber' | 'slate' }> = {
  HEALTHY: { label: 'Sehat', variant: 'mint' },
  DEGRADED: { label: 'Data menua', variant: 'amber' },
  FAILING: { label: 'Gagal berulang', variant: 'amber' },
  NEVER_SYNCED: { label: 'Belum pernah sync', variant: 'amber' },
  DISABLED: { label: 'Nonaktif', variant: 'slate' },
};

/**
 * Which health a row shows.
 *
 * Recomputed in the browser rather than sent from the server so the badge
 * matches the clock the operator is looking at: a page left open overnight
 * should say "data menua", not keep last night's "sehat".
 */
function healthOf(source: AdminJobSource): keyof typeof HEALTH {
  if (!source.isActive) return 'DISABLED';
  if (source.consecutiveFailures >= 3) return 'FAILING';
  if (!source.lastSuccessfulSyncAt) return 'NEVER_SYNCED';
  const ageMinutes = (Date.now() - new Date(source.lastSuccessfulSyncAt).getTime()) / 60_000;
  return ageMinutes > source.syncIntervalMinutes * 3 ? 'DEGRADED' : 'HEALTHY';
}

/** Jobs providers: health, freshness, and the two buttons that change anything. */
export default function AdminCareersPage() {
  const sources = useAdminResource(useCallback(() => getAdminJobSources(), []));
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Record<string, string>>({});

  const act = async (source: AdminJobSource, action: 'sync' | 'enable' | 'disable') => {
    setBusy(`${source.id}:${action}`);
    try {
      const result = await runAdminJobSourceAction(source.id, action);
      setOutcome((previous) => ({
        ...previous,
        [source.id]: 'status' in result
          ? `Sync ${result.status.toLowerCase()} — ${result.totals.itemsSeen} dibaca, ${result.totals.itemsCreated} baru, ${result.totals.itemsUpdated} diperbarui, ${result.totals.itemsInvalid} ditolak, ${result.totals.itemsClosed} ditutup.${result.errorCode ? ` (${result.errorCode})` : ''}`
          : `Sumber sekarang ${result.isActive ? 'aktif' : 'nonaktif'}.`,
      }));
      await sources.refresh();
    } catch (error) {
      setOutcome((previous) => ({
        ...previous,
        [source.id]: error instanceof ArenaApiError ? error.message : 'Tindakan gagal dijalankan.',
      }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell
      title="Sumber lowongan"
      description="Kesehatan tiap provider lowongan, kapan terakhir berhasil sync, dan pemicu manual. Menonaktifkan sumber menghentikan data baru; lowongan lamanya berhenti direkomendasikan tanpa dihapus dari riwayat."
      action={<AdminRefreshButton refresh={sources.refresh} loading={sources.loading} />}
    >
      {sources.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {sources.error.message}
        </div>
      )}

      {sources.data?.length === 0 && (
        <Card className="p-6">
          <PanelHeading>Belum ada sumber terdaftar</PanelHeading>
          <p className="mt-2 text-sm leading-relaxed text-sk-muted">
            Halaman Jobs peserta akan kosong sampai satu sumber didaftarkan. Pipeline-nya sendiri sudah lengkap:
            daftarkan satu baris <code className="rounded bg-sk-blue-wash px-1">arena.job_sources</code> dengan adapter
            <code className="mx-1 rounded bg-sk-blue-wash px-1">http-json</code>, konfigurasi feed, dan nama variabel
            environment tempat tokennya disimpan. Lihat <code className="rounded bg-sk-blue-wash px-1">docs/backend/JOBS_PIPELINE.md</code>.
          </p>
        </Card>
      )}

      <div className="grid gap-4">
        {(sources.data ?? []).map((source) => {
          const health = healthOf(source);
          return (
            <Card key={source.id} className="p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-bold text-sk-navy">{source.name}</h2>
                    <Badge variant={HEALTH[health].variant}>{HEALTH[health].label}</Badge>
                    <Badge variant="slate">{source.adapter}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-sk-muted">{source.slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null || !source.isActive}
                    onClick={() => void act(source, 'sync')}
                    iconLeft={<Play size={14} aria-hidden />}
                  >
                    {busy === `${source.id}:sync` ? 'Menarik…' : 'Tarik sekarang'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => void act(source, source.isActive ? 'disable' : 'enable')}
                    iconLeft={<Power size={14} aria-hidden />}
                  >
                    {source.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                </div>
              </div>

              <dl className="grid gap-3 text-[12.5px] sm:grid-cols-3">
                <div>
                  <dt className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">SYNC BERHASIL TERAKHIR</dt>
                  <dd className="mt-1 text-sk-navy">{source.lastSuccessfulSyncAt ? jakartaDate(source.lastSuccessfulSyncAt) : 'Belum pernah'}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">INTERVAL</dt>
                  <dd className="mt-1 text-sk-navy">setiap {source.syncIntervalMinutes} menit · stale setelah {source.stalenessDays} hari</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">LOWONGAN</dt>
                  <dd className="mt-1 text-sk-navy">
                    {Object.entries(source.openings).map(([status, count]) => `${count} ${status.toLowerCase()}`).join(' · ') || 'belum ada'}
                  </dd>
                </div>
              </dl>

              {source.credentialEnvVar && (
                <p className="mt-3 text-[12px] text-sk-muted">
                  Kredensial dibaca dari <code className="rounded bg-sk-blue-wash px-1">{source.credentialEnvVar}</code> —{' '}
                  {source.credentialConfigured ? 'sudah ter-set di environment ini.' : 'BELUM ter-set; sync akan gagal sampai variabel ini diisi.'}
                </p>
              )}

              {source.leaseHeld && <p className="mt-2 text-[12px] text-sk-muted">Sedang di-sync worker lain; tombol tarik akan dilewati sampai lease selesai.</p>}

              {source.consecutiveFailures > 0 && (
                <p className="mt-3 flex items-start gap-2 text-[12px] text-sk-error">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{source.consecutiveFailures} kegagalan berturut-turut. {source.lastErrorCode ? `Kode: ${source.lastErrorCode}. ` : ''}{source.lastErrorMessage ?? ''}</span>
                </p>
              )}

              {source.lastRun && (
                <p className="mt-3 border-t border-dashed border-sk-border pt-3 text-[12px] text-sk-muted">
                  Run terakhir {source.lastRun.status.toLowerCase()} ({source.lastRun.triggeredBy}) pada {jakartaDate(source.lastRun.startedAt)} —{' '}
                  {source.lastRun.itemsSeen} dibaca, {source.lastRun.itemsCreated} baru, {source.lastRun.itemsUpdated} diperbarui,{' '}
                  {source.lastRun.itemsInvalid} ditolak, {source.lastRun.itemsClosed} ditutup.
                </p>
              )}

              {outcome[source.id] && <p role="status" className="mt-3 text-[12.5px] text-sk-navy">{outcome[source.id]}</p>}
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
