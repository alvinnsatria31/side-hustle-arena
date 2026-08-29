import Link from 'next/link';
import { Clock, Zap, Lock } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { SkillChip } from '@/components/primitives/SkillChip';
import { ArrowRight } from 'lucide-react';
import type { WeeklyProject } from '@/types/project';
import { cn } from '@/lib/cn';

interface ProjectCardProps {
  project: WeeklyProject;
  locked?: boolean;
  selected?: boolean;
  className?: string;
}

export function ProjectCard({ project, locked, selected, className }: ProjectCardProps) {
  return (
    <Card
      padding="lg"
      className={cn(
        'h-full flex flex-col group transition-shadow',
        locked && 'opacity-65',
        selected && 'ring-1 ring-[var(--color-brand-300)] border-[var(--color-brand-200)]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Badge variant="brand" size="sm">{project.division}</Badge>
        {selected && <Badge variant="success" size="sm">Dipilih</Badge>}
        {locked && !selected && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-tertiary)]">
            <Lock className="h-3 w-3" />
            Locked
          </span>
        )}
      </div>

      <h3 className="mt-4 text-[18px] font-semibold text-[var(--color-ink-primary)] leading-snug">
        {project.title}
      </h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-ink-tertiary)] line-clamp-3">
        {project.case}
      </p>

      <ul className="mt-5 flex flex-wrap gap-1.5">
        {project.skills.slice(0, 3).map((s) => (
          <li key={s}>
            <SkillChip label={s} size="sm" />
          </li>
        ))}
        {project.skills.length > 3 && (
          <li>
            <span className="inline-flex items-center h-6 px-2 text-[11px] font-semibold text-[var(--color-ink-tertiary)]">
              +{project.skills.length - 3}
            </span>
          </li>
        )}
      </ul>

      <div className="mt-5 pt-5 border-t border-[var(--color-border)] flex items-center justify-between text-[12.5px] text-[var(--color-ink-tertiary)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {project.effort}
          </span>
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
            +{project.rewardPoints} pts
          </span>
        </div>
        <span className="text-[var(--color-ink-tertiary)]">{project.difficulty}</span>
      </div>

      <div className="mt-5 flex">
        {locked ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-ink-tertiary)] font-medium">
            <Lock className="h-3.5 w-3.5" />
            Pilih 1 project per minggu
          </span>
        ) : (
          <Link
            href={`/arena/projects/${project.slug}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)] group-hover:gap-2 transition-all"
          >
            Lihat Project
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </Card>
  );
}
