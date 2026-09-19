import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Entrance } from '@/components/motion/Reveal';
import { ProjectBrowser } from '@/components/arena/ProjectBrowser';
import { getPublicProjects } from '@/lib/arena-view';

export const metadata = { title: 'Arena · Proyek Minggu Ini' };
export const dynamic = 'force-dynamic';

export default async function AppArenaProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ groups, projects }, params] = await Promise.all([getPublicProjects(), searchParams]);
  return (
    <div>
      <Breadcrumb items={[{ label: 'Beranda', href: '/app' }, { label: 'Arena', href: '/app/arena' }, { label: 'Proyek' }]} />
      <Entrance className="mb-6 mt-5">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[34px]">Proyek Minggu Ini</h1>
        <p className="mt-2 max-w-[600px] text-[14px] leading-relaxed text-sk-muted">
          Pilih satu proyek yang sesuai dengan kemampuan yang ingin kamu latih.
        </p>
      </Entrance>
      {projects.length === 0 ? (
        <p role="status" className="border-y border-sk-border py-10 text-[14px] text-sk-muted">
          Belum ada proyek yang dibuka. Proyek baru biasanya hadir setiap Senin. Cek lagi nanti, ya.
        </p>
      ) : (
        <ProjectBrowser hrefPrefix="/app/arena/projects" projects={projects} groups={groups} showRecommended={false} initialSavedOnly={params.view === 'saved'} />
      )}
    </div>
  );
}
