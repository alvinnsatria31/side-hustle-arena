import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Entrance } from '@/components/motion/Reveal';
import { ProjectBrowser } from '@/components/arena/ProjectBrowser';

export const metadata = { title: 'Project Minggu Ini' };

export default function ArenaBrowsePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-28 md:pt-32">
      <Breadcrumb items={[{ label: 'Arena', href: '/arena' }, { label: 'Project Minggu Ini' }]} />
      <Entrance className="mb-6 mt-7">
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[36px]">Project Minggu Ini</h1>
        <p className="mt-2 max-w-[600px] text-[14px] leading-relaxed text-sk-muted">
          Pilih satu project yang paling sesuai dengan skill yang ingin kamu bangun.
        </p>
      </Entrance>
      <ProjectBrowser />
    </div>
  );
}
