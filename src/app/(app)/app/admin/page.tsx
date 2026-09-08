import { getOpsOverview } from '@/server/admin/overview';
import { AdminShell, AdminServerRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';

export const dynamic = 'force-dynamic';

function jakartaDate(value: string | Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

export default async function AdminOverviewPage() {
  const overview = await getOpsOverview();

  return (
    <AdminShell title="Overview" action={<AdminServerRefreshButton />}>
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Minggu aktif" value={overview.week?.weekCode ?? '—'} sub={overview.week?.status ?? 'Tidak ada minggu berjalan'} />
        <Stat label="Enrollment" value={overview.enrollments} sub={`${overview.versions} submission`} />
        <Stat
          label="Butuh resolusi"
          value={overview.needsResolution.length}
          sub="Review AI vs judge berbeda"
          tone={overview.needsResolution.length > 0 ? 'warning' : undefined}
        />
        <Stat label="Katalog reward aktif" value={`${overview.catalog.active}/${overview.catalog.total}`} sub="SKU" />
      </div>

      {/* Health above depth on purpose: a count tells an operator how much is
          queued, and only this tells them whether anything is wrong. */}
      <Card className="mb-6 p-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <PanelHeading>Kesehatan otomasi</PanelHeading>
          <Badge variant={overview.health.level === 'OK' ? 'mint' : 'amber'}>
            {overview.health.level === 'OK' ? 'NORMAL' : overview.health.level === 'WARN' ? 'PERLU DICEK' : 'PERLU TINDAKAN'}
          </Badge>
        </div>
        {overview.health.signals.length === 0 ? (
          <p className="text-sm text-sk-muted">
            Tidak ada sinyal masalah. Heartbeat job terjadwal, antrean review, outbox email, sumber lowongan dan kuota
            pemindaian CV semuanya dalam batas.
          </p>
        ) : (
          <ul className="space-y-3">
            {overview.health.signals.map((signal) => (
              <li key={signal.key} className="border-l-2 border-sk-border pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={signal.level === 'ALERT' ? 'amber' : 'slate'}>{signal.level}</Badge>
                  <span className="text-sm text-sk-navy">{signal.detail}</span>
                </div>
                {signal.action && <p className="mt-1 text-xs leading-relaxed text-sk-muted">{signal.action}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-2 border-t border-dashed border-sk-border pt-4 text-xs text-sk-muted sm:grid-cols-2">
          <p>
            Outbox email: {overview.health.email.backlog} menunggu, {overview.health.email.held} tertahan,{' '}
            {overview.health.email.agingPastHalfWindow} melewati separuh jendela retry.
          </p>
          <p>
            Pemindaian CV jam ini:{' '}
            {overview.health.cvSpend.available
              ? `${overview.health.cvSpend.used}/${overview.health.cvSpend.ceiling}`
              : 'penghitung tidak terbaca'}.
          </p>
          <p className="sm:col-span-2">
            Heartbeat:{' '}
            {overview.health.heartbeats
              .map((beat) => `${beat.job} ${beat.lastRunAt ? jakartaDate(beat.lastRunAt) : 'belum pernah'}${beat.overdue ? ' (telat)' : ''}`)
              .join(' · ')}
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <PanelHeading>Antrean Review</PanelHeading>
          {Object.keys(overview.queue).length === 0 ? (
            <p className="text-sm text-sk-muted">Tidak ada job di antrean.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(overview.queue).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="text-sk-body">{status}</span>
                  <span className="font-bold tabular-nums text-sk-navy">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <PanelHeading>Saklar Fitur</PanelHeading>
          <ul className="space-y-2.5">
            {overview.flags.map((flag) => (
              <li key={flag.key} className="flex items-center justify-between text-sm">
                <span className="text-sk-body">{flag.label}</span>
                <Badge variant={flag.state.closed ? 'amber' : 'mint'}>{flag.state.closed ? 'DITUTUP' : 'TERBUKA'}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <PanelHeading>Redemption</PanelHeading>
          {overview.redemptions.length === 0 ? (
            <p className="text-sm text-sk-muted">Belum ada klaim reward.</p>
          ) : (
            <ul className="space-y-2">
              {overview.redemptions.map((row) => (
                <li key={row.status} className="flex items-center justify-between text-sm">
                  <span className="text-sk-body">{row.status}</span>
                  <span className="font-bold tabular-nums text-sk-navy">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <PanelHeading>Audit Terbaru</PanelHeading>
          {overview.recentAudit.length === 0 ? (
            <p className="text-sm text-sk-muted">Belum ada aktivitas admin.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs text-sk-muted">
                  <tr>
                    <th className="py-2 pr-4">Aksi</th>
                    <th className="py-2 pr-4">Entitas</th>
                    <th className="py-2 pr-4">Oleh</th>
                    <th className="py-2">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sk-border">
                  {overview.recentAudit.map((row, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-semibold text-sk-navy">{row.action}</td>
                      <td className="py-2 pr-4 text-sk-body">{row.entityType}</td>
                      <td className="py-2 pr-4 text-sk-body">{row.actorSubject}</td>
                      <td className="py-2 text-xs text-sk-muted">{jakartaDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'warning' }) {
  return (
    <Card className="p-5">
      <div className="text-xs text-sk-muted">{label}</div>
      <div className={`mt-2 text-2xl font-extrabold ${tone === 'warning' && Number(value) > 0 ? 'text-sk-warning' : 'text-sk-navy'}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-sk-muted">{sub}</div>}
    </Card>
  );
}
