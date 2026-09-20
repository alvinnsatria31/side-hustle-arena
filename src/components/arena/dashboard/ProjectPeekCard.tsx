import Link from 'next/link';
import { ArrowRight, Clock3, Users } from 'lucide-react';
import { ProjectMiniVisual, motifForDivision } from '@/components/landing/ProjectMiniVisual';
import type { PublicArenaHome } from '@/lib/arena-view';

type Project = PublicArenaHome['projects'][number];

/**
 * A brief on offer this week.
 *
 * The old card showed a category, a title and a deliverable — nothing about
 * the two things a participant weighs before committing a week: how long it
 * takes and whether anyone else picked it. Both were already in the payload.
 */
export function ProjectPeekCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/app/arena/projects/${encodeURIComponent(project.slug)}`}
      className="card-rise group flex flex-col overflow-hidden rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
    >
      <div aria-hidden className="h-28 overflow-hidden border-b border-sk-border">
        <ProjectMiniVisual motif={motifForDivision(project.categorySlug, project.category)} />
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-sk-blue-700">
          {project.category}
        </p>
        <h3 className="mt-2 text-[16px] font-bold leading-snug tracking-[-0.02em] text-sk-navy">
          {project.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-sk-muted">
          {project.deliverable}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-sk-faint">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={12} aria-hidden />
            {project.estimatedTime}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={12} aria-hidden />
            {project.participantCount} peserta
          </span>
        </div>

        <span className="mt-4 inline-flex items-center gap-1 border-t border-sk-border pt-3.5 text-[12.5px] font-bold text-sk-blue">
          Lihat brief
          <ArrowRight
            size={13}
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}
