import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Entrance } from '@/components/motion/Reveal';
import { ProjectBrowser } from '@/components/arena/ProjectBrowser';
import { getPublicProjects } from '@/lib/arena-view';

export const metadata = { title: 'Arena · Projects' };
export const dynamic = 'force-dynamic';

export default async function AppArenaProjectsPage() {
  const { groups, projects } = await getPublicProjects();
  return (
    <div>
      <Breadcrumb items={[{ label: 'App', href: '/app' }, { label: 'Arena', href: '/app/arena' }, { label: 'Projects' }]} />
      <Entrance className="mb-6 mt-5">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[34px]">Project Minggu Ini</h1>
        <p className="mt-2 max-w-[600px] text-[14px] leading-relaxed text-sk-muted">
          Pilih satu project yang paling sesuai dengan skill yang ingin kamu bangun.
        </p>
      </Entrance>
      {projects.length === 0 ? (
        <p role="status" className="border-y border-sk-border py-10 text-[14px] text-sk-muted">
          Belum ada project yang dibuka. Project baru rilis setiap Senin — cek lagi nanti.
        </p>
      ) : (
        <ProjectBrowser hrefPrefix="/app/arena/projects" projects={projects} groups={groups} showRecommended={false} />
      )}
    </div>
  );
}
