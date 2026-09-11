'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { Badge } from '@/components/primitives/Badge';
import { DifficultyBadge, TimeBadge } from './ProjectBadges';
import type { ArenaProject } from '@/types/project';
import { cn } from '@/lib/cn';

interface RecommendedCardProps {
  project: ArenaProject;
  reason?: string;
  eyebrow?: string;
  ctaLabel?: string;
  href?: string;
  /** Route prefix used when `href` is not provided. */
  hrefPrefix?: string;
  onCtaClick?: () => void;
  compact?: boolean;
  className?: string;
  delay?: number;
}

/**
 * Bright blue recommendation card (CV result bridge, career report, arena hub).
 * Grid collapses to a single column on mobile.
 */
export function RecommendedCard({
  project,
  reason = 'Direkomendasikan berdasarkan hasil CV Scanner kamu.',
  eyebrow = 'Langkah Terbaik Selanjutnya',
  ctaLabel = 'Lihat Project di Arena',
  href,
  hrefPrefix = '/arena/projects',
  onCtaClick,
  compact,
  className,
  delay = 0,
}: RecommendedCardProps) {
  const reduce = useSettledReducedMotion();
  const to = href ?? `${hrefPrefix}/${project.slug}`;

  return (
    <motion.section
      aria-label={`Project direkomendasikan: ${project.title}`}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay }}
      className={cn(
        'relative grid overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-sk-blue via-[#3b7dff] to-[#5c93ff] p-7 text-white sm:p-8',
        compact ? 'grid-cols-1' : 'md:grid-cols-[1.4fr_1fr] md:items-center md:gap-8',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-40 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14),transparent_70%)]"
      />
      <div className="relative z-[1]">
        <span className="eyebrow eyebrow-dark !text-white/90">{eyebrow}</span>
        <h3 className="mb-2 mt-2.5 text-[22px] font-bold tracking-[-0.02em] sm:text-[26px]">{project.title}</h3>
        <p className="mb-[18px] max-w-[440px] text-[13.5px] leading-relaxed text-white/85">{reason}</p>
        {onCtaClick ? (
          <button
            onClick={onCtaClick}
            className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-sk-md)] bg-white px-[22px] text-[13.5px] font-bold text-sk-blue shadow-md transition-transform duration-200 hover:-translate-y-px active:scale-[0.98]"
          >
            {ctaLabel}
          </button>
        ) : (
          <Link
            href={to}
            className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-sk-md)] bg-white px-[22px] text-[13.5px] font-bold text-sk-blue shadow-md transition-transform duration-200 hover:-translate-y-px active:scale-[0.98]"
          >
            {ctaLabel}
          </Link>
        )}
      </div>

      <div className="relative z-[1] mt-6 rounded-[var(--radius-sk-lg)] border border-white/25 bg-white/15 p-5 backdrop-blur-md md:mt-0">
        <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-white/75">Direkomendasikan</div>
        <h4 className="mb-3 text-[17px] font-bold">{project.title}</h4>
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          <Badge variant="dark">{project.category}</Badge>
          <DifficultyBadge level={project.difficulty} dark />
          <TimeBadge time={project.estimatedTime} dark />
          <Badge variant="dark">+{project.points} pts</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {project.skills.map((skill) => (
            <span key={skill} className="rounded-full border border-white/35 px-2 py-0.5 text-[10.5px] font-medium">
              {skill}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
