'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Gift } from 'lucide-react';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { REWARDS_PATH } from '@/components/layout/nav-links';
import { getParticipantMilestones, useParticipantResource } from '@/lib/participant-client';
import { formatPoints, rewardProgress } from '@/lib/reward-progress';

/**
 * The reward ladder's next unclaimed step, as a small progress card.
 *
 * Reuses the same `rewardProgress` math the profile page's reward section and
 * the public roadmap use, so "260 poin lagi" here always agrees with what the
 * profile shows.
 */
export function RewardPreviewCard() {
  const resource = useParticipantResource(getParticipantMilestones);
  const ladder = resource.data?.ladder;

  if (!ladder) {
    return (
      <div className="rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-sk-bg" />
        <div className="mt-3 h-5 w-40 animate-pulse rounded bg-sk-bg" />
        <div className="mt-4 h-1.5 w-full animate-pulse rounded-full bg-sk-bg" />
      </div>
    );
  }

  const progress = rewardProgress(ladder.lifetimePoints, ladder.steps);

  return (
    <motion.section
      aria-labelledby="reward-preview-title"
      className="flex flex-col rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.18, ease: 'easeOut' }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-sk-md)] bg-sk-violet-tint text-sk-violet"
        >
          <Gift size={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <p
            id="reward-preview-title"
            className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-sk-violet"
          >
            Reward berikutnya
          </p>
          <p className="truncate text-[14.5px] font-bold text-sk-navy">
            {progress.next ? progress.next.title : 'Semua hadiah terbuka'}
          </p>
        </div>
      </div>

      {progress.next ? (
        <>
          <div className="mt-4">
            <ProgressBar
              value={progress.next.percent}
              className="h-2"
              barClassName="bg-gradient-to-r from-sk-violet to-sk-violet-600"
              delay={0.35}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="font-mono text-sk-muted">
              {formatPoints(progress.points)} / {formatPoints(progress.next.pointsRequired)}
            </span>
            <span className="font-bold text-sk-violet">{formatPoints(progress.next.remaining)} poin lagi</span>
          </div>
        </>
      ) : (
        <p className="mt-4 text-[12.5px] leading-relaxed text-sk-muted">
          Semua hadiah di tangga sudah terbuka. Tukarkan poinmu di katalog hadiah.
        </p>
      )}

      <Link
        href={REWARDS_PATH}
        className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-bold text-sk-blue hover:underline"
      >
        Buka Poin &amp; hadiah
      </Link>
    </motion.section>
  );
}
