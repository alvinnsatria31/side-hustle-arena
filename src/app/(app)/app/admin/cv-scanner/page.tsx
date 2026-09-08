import { redirect } from 'next/navigation';
import { requireArenaAdminSession } from '@/server/admin/auth';
import { AdminShell, AdminServerRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { getCvScannerOps } from '@/server/admin/cv-ops';

export const dynamic = 'force-dynamic';

/**
 * CV Scanner had no console page at all: its only trace was the `cv-spend`
 * signal on Overview, which appears once spend crosses 80% of the ceiling and
 * says nothing before that. This is the page that answers "how busy is it, and
 * how close to refusing people" before it becomes an incident.
 *
 * Read-only on purpose. The ceiling lives in `CV_SCAN_HOURLY_CAP`, so a control
 * here would need an endpoint, a scope and an audit trail to change something
 * an environment variable already owns.
 */
export default async function AdminCvScannerPage() {
  const admin = await requireArenaAdminSession();
  if (!admin.scopes.includes('overview')) redirect('/app/admin');

  const ops = await getCvScannerOps();
  const { spend } = ops;
  const pct = spend.used !== null && spend.ceiling > 0 ? Math.round((spend.used / spend.ceiling) * 100) : null;

  return (
    <AdminShell
      title="CV Scanner"
      description="Volume pemindaian dan sisa kuota jam berjalan. Hanya-baca — plafonnya diatur lewat environment variable."
      action={<AdminServerRefreshButton />}
    >
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat
          label="Kuota jam ini"
          value={spend.available ? `${spend.used}/${spend.ceiling}` : '—'}
          sub={spend.available ? `${pct}% terpakai` : 'Penghitung tidak terbaca'}
          tone={!spend.available || (pct !== null && pct >= 80) ? 'warning' : undefined}
        />
        <Stat label="Scan 24 jam" value={ops.scansLast24h} sub="Termasuk yang gagal di sisi model" />
        <Stat label="Scan 7 hari" value={ops.scansLast7d} sub="Total pemindaian tersimpan" />
      </div>

      {!spend.available && (
        <div role="alert" className="mb-6 border-l-2 border-sk-warning bg-sk-warning-wash p-4 text-sm text-sk-warning-ink">
          Penghitung kuota tidak bisa dibaca. Ini bukan berarti nol pemindaian — angka kuota di atas sedang tidak
          diketahui, dan pembatasan mungkin tidak bekerja seperti seharusnya.
        </div>
      )}

      <Card className="p-6">
        <PanelHeading>Yang tidak disimpan</PanelHeading>
        <p className="mt-3 text-[13px] leading-relaxed text-sk-body">
          Tabel <code className="font-mono text-xs">cv_scans</code> hanya menyimpan hasil analisis. Berkas yang
          diunggah dan teks yang diekstrak <strong>tidak pernah</strong> disimpan, jadi tidak ada isi CV yang bisa
          ditinjau atau dimoderasi dari sini — dan tidak perlu dicari.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-sk-muted">
          Plafon per jam dibaca dari <code className="font-mono text-xs">CV_SCAN_HOURLY_CAP</code>. Untuk menutup
          fitur ini sepenuhnya saat insiden, gunakan <strong>Saklar Darurat</strong>.
        </p>
      </Card>
    </AdminShell>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: 'warning' }) {
  return (
    <Card className="p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-sk-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-sk-navy">{value}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-sk-muted">{sub}</p>
      {tone === 'warning' && (
        <Badge variant="amber" className="mt-2">
          Perlu dicek
        </Badge>
      )}
    </Card>
  );
}
