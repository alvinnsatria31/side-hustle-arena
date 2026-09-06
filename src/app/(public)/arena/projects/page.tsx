import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Entrance } from '@/components/motion/Reveal';
import { ProjectBrowser } from '@/components/arena/ProjectBrowser';
import { getPublicProjects } from '@/lib/arena-view';

export const metadata = { title: 'Project Minggu Ini' };
export const dynamic = 'force-dynamic';

export default async function ArenaBrowsePage() {
  const { groups, projects } = await getPublicProjects();
  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-28 md:pt-32">
      <Breadcrumb items={[{ label: 'Arena', href: '/arena' }, { label: 'Project Minggu Ini' }]} />
      <Entrance className="mb-6 mt-7">
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[36px]">Project Minggu Ini</h1>
        <p className="mt-2 max-w-[600px] text-[14px] leading-relaxed text-sk-muted">
          Pilih satu project yang paling sesuai dengan skill yang ingin kamu bangun.
        </p>
      </Entrance>
      {projects.length === 0 ? (
        <p role="status" className="border-y border-sk-border py-10 text-[14px] text-sk-muted">
          Belum ada project yang dibuka. Project baru rilis setiap Senin — cek lagi nanti.
        </p>
      ) : (
        <ProjectBrowser projects={projects} groups={groups} showRecommended={false} />
      )}
    </div>
  );
}
