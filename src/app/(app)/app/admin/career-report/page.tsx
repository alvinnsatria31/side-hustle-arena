import { redirect } from 'next/navigation';
import { requireArenaAdminSession } from '@/server/admin/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { ButtonLink } from '@/components/primitives/Button';

export const dynamic = 'force-dynamic';

/**
 * A deliberate placeholder, not an unfinished page.
 *
 * Career Report has nothing operational to report: `getCareerReport()` derives
 * everything on the fly from the participant overview, the latest CV and the
 * skill taxonomy. There is no table, no generation event and no failure that
 * gets written down, so any count shown here would have to be invented.
 *
 * It keeps a menu entry anyway so the rail matches the subdomain an operator
 * actually sees. Saying plainly that there is nothing to manage is more useful
 * than a page of zeroes that look like an outage.
 */
export default async function AdminCareerReportPage() {
  const admin = await requireArenaAdminSession();
  if (!admin.scopes.includes('overview')) redirect('/app/admin');

  return (
    <AdminShell
      title="Career Report"
      description="Belum tersedia. Halaman ini menjelaskan kenapa, supaya tidak ada yang mencari kontrol yang memang tidak ada."
    >
      <Card className="p-6">
        <PanelHeading>Belum ada yang bisa dikelola di sini</PanelHeading>
        <p className="mt-3 text-[13px] leading-relaxed text-sk-body">
          Career Report tidak disimpan. Setiap kali peserta membukanya, laporan itu dihitung ulang saat itu juga dari
          rangkuman peserta, hasil CV Scanner terakhir, dan taksonomi skill. Tidak ada tabel laporan, tidak ada
          catatan pembuatan, dan tidak ada kegagalan yang tercatat.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-sk-body">
          Artinya tidak ada antrean yang bisa macet dan tidak ada angka yang jujur untuk ditampilkan di sini. Kalau
          sebuah laporan terlihat salah, sebabnya ada di sumbernya — data peserta atau hasil scan-nya.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <ButtonLink href="/app/admin/users">Buka Peserta</ButtonLink>
          <ButtonLink href="/app/admin/cv-scanner" variant="ghost">
            Buka CV Scanner
          </ButtonLink>
        </div>
      </Card>
    </AdminShell>
  );
}
