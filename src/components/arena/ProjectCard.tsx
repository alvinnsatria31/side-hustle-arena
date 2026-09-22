'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Timer } from 'lucide-react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { FOLDER_LIFT, FOLDER_WRAP, FolderSheets } from '@/components/motion/FolderStack';
import { Badge } from '@/components/primitives/Badge';
import { SkillChip } from '@/components/primitives/SkillChip';
import { ProjectCover } from './ProjectCover';
import { difficultyLabel } from './ProjectBadges';
import type { ArenaProject } from '@/types/project';
import { cn } from '@/lib/cn';

interface ProjectCardProps {
  project: ArenaProject;
  recommended?: boolean;
  href?: string;
  /** Route prefix, e.g. "/app/arena/projects" inside the demo app. */
  hrefPrefix?: string;
  /** Position in its grid: staggers the entrance, capped so a long list never waits. */
  index?: number;
}

/**
 * Editorial project card mirroring the systematic reference grid:
 * level + points chips + time → 16:9 visual → title → desc → skills →
 * proof strip (only when the data exists) → participants + deadline →
 * Preview Rubrik + per-division CTA.
 *
 * Hover is the SekolahKarir Tools folder: the sheets behind the card fan
 * open while the card lifts and tips, the cover zooms a touch and the arrow
 * steps forward. The outer element stays the motion node so the browser's
 * layout and exit animations keep working through the wrapper.
 */
export function ProjectCard({ project, recommended, href, hrefPrefix = '/arena/projects', index = 0 }: ProjectCardProps) {
  const reduce = useSettledReducedMotion();
  const to = href ?? `${hrefPrefix}/${project.slug}`;

  return (
    <motion.div
      layout
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.05, 0.25) }}
      className={FOLDER_WRAP}
    >
      <FolderSheets tab={!recommended} />
      <article
        className={cn(
          'flex flex-col gap-3 rounded-[var(--radius-sk-2xl)] border bg-white p-4',
          FOLDER_LIFT,
          recommended ? 'border-sk-blue shadow-sk-rec' : 'border-sk-border shadow-sm group-hover:border-sk-blue/40',
        )}
      >
        {recommended && (
          <span className="absolute -top-2.5 left-5">
            <Badge variant="recommended">Direkomendasikan untukmu</Badge>
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-sk-track px-2.5 py-1 font-mono text-[11px] font-semibold uppercase leading-none text-sk-muted">
            {difficultyLabel(project.difficulty)}
          </span>
          {project.points != null && (
            <span className="inline-flex items-center rounded-full bg-sk-blue-tint px-2.5 py-1 font-mono text-[11px] font-semibold uppercase leading-none text-sk-blue">
              Rubrik {project.points} poin
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase text-sk-muted">
            <Timer size={12} aria-hidden />
            {project.estimatedTime}
          </span>
        </div>

        <ProjectCover
          slug={project.slug}
          title={project.title}
          category={project.category}
          coverImageUrl={project.coverImageUrl}
          className="[&>*]:transition-transform [&>*]:duration-300 [&>*]:ease-out motion-safe:group-hover:[&>*]:scale-[1.05]"
        />

        <h3 className="text-[16.5px] font-bold leading-snug tracking-[-0.01em] text-sk-navy">
          <Link href={to}>{project.title}</Link>
        </h3>

        <p className="text-[12.5px] leading-relaxed text-sk-muted">{project.shortDescription}</p>

        <div className="flex flex-wrap gap-1.5">
          {project.skills.map((skill) => (
            <SkillChip key={skill}>{skill}</SkillChip>
          ))}
        </div>

        {project.resources.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-sk-bg px-2.5 py-2 text-[12px] font-medium text-sk-body">
            <span aria-hidden className="text-sk-blue">▣</span>
            <span className="truncate">{project.resources[0].title}</span>
            {project.resources.length > 1 && (
              <span className="shrink-0 font-mono text-[11px] text-sk-muted">+{project.resources.length - 1}</span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-1 text-[12px] text-sk-muted">
          {project.participants != null ? (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sk-blue" />
              {project.participants} peserta
            </span>
          ) : (
            <span />
          )}
          <span>
            Batas: <span className="font-semibold text-sk-navy">{project.deadlineLabel}</span>
          </span>
        </div>

        <div className="flex gap-2">
          <Link
            href={to}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-[var(--radius-sk-md)] bg-sk-track px-3 text-[12.5px] font-semibold text-sk-navy transition-colors hover:bg-sk-border"
          >
            Lihat rubrik
          </Link>
          <Link
            href={to}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-[var(--radius-sk-md)] bg-sk-blue px-3 text-[12.5px] font-bold text-white shadow-sk-btn transition-all hover:-translate-y-px hover:bg-sk-blue-700"
          >
            Lihat proyek
          </Link>
        </div>
      </article>
    </motion.div>
  );
}
