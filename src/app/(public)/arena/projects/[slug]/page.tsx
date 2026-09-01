import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Badge } from '@/components/primitives/Badge';
import { Entrance } from '@/components/motion/Reveal';
import { ResourceList } from '@/components/arena/KanbanPreview';
import { Card } from '@/components/primitives/Card';
import { CtaActions, DetailTabs } from '@/components/arena/ProjectDetail';
import { ARENA_WEEK } from '@/data/mock/arena';
import { getProject, mockProjects } from '@/data/mock/projects';

export function generateStaticParams() {
  return mockProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  return { title: project ? project.title : 'Project tidak ditemukan' };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-28 md:pt-32">
      <Breadcrumb
        items={[
          { label: 'Arena', href: '/arena' },
          { label: 'Project Minggu Ini', href: '/arena/projects' },
          { label: project.title },
        ]}
      />

      {/* Dark navy hero */}
      <Entrance className="mt-6">
        <div className="relative mb-7 overflow-hidden rounded-[var(--radius-sk-3xl)] bg-sk-navy-2 p-8 text-white sm:p-10">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-[260px] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(36,107,253,0.35),transparent_65%)]"
          />
          <div className="relative z-[1]">
            <span className="eyebrow eyebrow-dark">
              {project.category} · Week {project.week}
            </span>
            <h1 className="mb-5 mt-3 max-w-[680px] text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[46px]">
              {project.title}
            </h1>
            <div className="mb-7 flex flex-wrap gap-2">
              <Badge variant="dark">{project.difficulty}</Badge>
              <Badge variant="dark">Estimasi {project.estimatedTime}</Badge>
              <Badge variant="dark">Deadline · {project.deadlineLabel}</Badge>
              <Badge variant="dark">+{project.points} points</Badge>
              <Badge variant="dark">{project.participants} peserta</Badge>
            </div>
            <CtaActions slug={project.slug} />
          </div>
        </div>
      </Entrance>

      <DetailTabs slug={project.slug} />

      {/* Side info card for mobile (desktop shows inside tabs layout) */}
      <Card className="mt-6 p-6 lg:hidden">
        <h4 className="mb-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
          Project Info
        </h4>
        <dl className="text-[13px]">
          {[
            ['Category', project.category],
            ['Difficulty', project.difficulty],
            ['Estimated Time', project.estimatedTime],
            ['Deadline', project.deadlineLabel],
            ['Points', `+${project.points}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-sk-border py-2.5 last:border-0">
              <dt className="text-sk-muted">{k}</dt>
              <dd className="font-bold text-sk-navy">{v}</dd>
            </div>
          ))}
        </dl>
        <h4 className="mb-3 mt-6 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Resources</h4>
        <ResourceList resources={project.resources} />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-sk-faint">
          Week {ARENA_WEEK} · project drop setiap Senin
        </p>
      </Card>
    </div>
  );
}
