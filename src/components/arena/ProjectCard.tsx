'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { Badge } from '@/components/primitives/Badge';
import { SkillChip } from '@/components/primitives/SkillChip';
import { DifficultyBadge, DeadlineBadge, TimeBadge } from './ProjectBadges';
import type { ArenaProject } from '@/types/project';
import { cn } from '@/lib/cn';

interface ProjectCardProps {
  project: ArenaProject;
  recommended?: boolean;
  href?: string;
  /** Route prefix, e.g. "/app/arena/projects" inside the demo app. */
  hrefPrefix?: string;
}

/** Editorial project card — hover: lift 2px + soft border accent + shadow. */
export function ProjectCard({ project, recommended, href, hrefPrefix = '/arena/projects' }: ProjectCardProps) {
  const reduce = useSettledReducedMotion();
  const to = href ?? `${hrefPrefix}/${project.slug}`;

  return (
    <motion.article
      layout
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={reduce ? undefined : { y: -2 }}
      className={cn(
        'relative flex h-full flex-col gap-3 rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-5 transition-shadow duration-200',
        recommended && 'border-sk-blue shadow-sk-rec',
        !recommended && 'hover:border-sk-blue/40 hover:shadow-sk-md',
      )}
    >
      {recommended && (
        <span className="absolute -top-2.5 left-5">
          <Badge variant="recommended">Direkomendasikan untukmu</Badge>
        </span>
      )}

      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-sk-muted">{project.category}</div>

      <h3 className="text-[16.5px] font-bold leading-snug tracking-[-0.01em] text-sk-navy">
        <Link href={to} className="after:absolute after:inset-0 after:content-['']">
          {project.title}
        </Link>
      </h3>

      <p className="text-[12.5px] leading-relaxed text-sk-muted">{project.shortDescription}</p>

      <div className="flex flex-wrap gap-1.5">
        <DifficultyBadge level={project.difficulty} />
        <TimeBadge time={project.estimatedTime} />
        <DeadlineBadge />
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-dashed border-sk-border pt-3">
        {project.skills.map((skill) => (
          <SkillChip key={skill}>{skill}</SkillChip>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between pt-1.5">
        {project.points != null ? (
          <span className="font-mono text-[12px] font-bold text-sk-blue">+{project.points} pts</span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-sk-blue">
          Lihat Detail
        </span>
      </div>
    </motion.article>
  );
}
