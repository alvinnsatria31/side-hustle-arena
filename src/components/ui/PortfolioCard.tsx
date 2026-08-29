import Link from 'next/link';
import { ArrowUpRight, Star } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { SkillChip } from '@/components/primitives/SkillChip';
import { cn } from '@/lib/cn';
import type { PortfolioProject } from '@/types/portfolio';

interface PortfolioCardProps {
  project: PortfolioProject;
  className?: string;
}

export function PortfolioCard({ project, className }: PortfolioCardProps) {
  return (
    <Card padding="lg" className={cn('h-full flex flex-col', className)}>
      <div className="flex items-center justify-between">
        <Badge variant="brand" size="sm">{project.division}</Badge>
        <div className="flex items-center gap-2">
          {project.featured && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-brand-600)]">
              <Star className="h-3 w-3 fill-current" />
              Featured
            </span>
          )}
          <Badge variant={project.status === 'published' ? 'success' : 'neutral'} size="sm">
            {project.status === 'published' ? 'Published' : 'Draft'}
          </Badge>
        </div>
      </div>

      <h3 className="mt-4 text-[18px] font-semibold text-[var(--color-ink-primary)] leading-snug">
        {project.title}
      </h3>
      <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
        {project.role} · {project.period}
      </p>

      <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--color-ink-secondary)] line-clamp-3">
        {project.summary}
      </p>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {project.skills.slice(0, 4).map((s) => (
          <li key={s}>
            <SkillChip label={s} size="sm" />
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[20px] font-bold text-[var(--color-ink-primary)] tabular-nums">{project.score}</span>
          <span className="text-[11.5px] text-[var(--color-ink-tertiary)]">score</span>
        </div>
        <Link
          href={project.status === 'published' ? `/app/portfolio/${project.id}/preview` : `/app/portfolio/${project.id}/edit`}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
        >
          {project.status === 'published' ? 'Lihat Preview' : 'Edit Case Study'}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
