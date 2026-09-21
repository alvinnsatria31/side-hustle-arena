'use client';

import { motion } from 'motion/react';
import { Check, Crown, Lock } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { RewardIcon } from '@/components/arena/MilestoneRoadmap';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import type { MilestoneLadder, MilestoneStep } from '@/lib/participant-client';
import { formatPoints } from '@/lib/reward-progress';
import { cn } from '@/lib/cn';

type Claim = (slug: string, retryOf: string | null) => void;

/** How far along the line the fill runs: node i sits at i/(n-1), interpolated by points. */
function trackFill(steps: MilestoneStep[], points: number): number {
  if (steps.length < 2) return points >= (steps[0]?.pointsRequired ?? 0) ? 1 : 0;
  const last = steps.length - 1;
  if (points >= steps[last].pointsRequired) return 1;
  if (points < steps[0].pointsRequired) return 0;
  const i = steps.findIndex((step, index) => index < last && points >= step.pointsRequired && points < steps[index + 1].pointsRequired);
  const from = steps[i].pointsRequired;
  const to = steps[i + 1].pointsRequired;
  return (i + (points - from) / (to - from)) / last;
}

function Node({ step, next }: { step: MilestoneStep; next: boolean }) {
  if (step.state === 'taken') {
    return (
      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-sk-success text-white shadow-[0_10px_22px_-10px_rgba(15,157,88,0.8)] ring-4 ring-white">
        <Check size={24} strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (step.state === 'ready') {
    return (
      <span className="relative grid h-14 w-14 place-items-center">
        <span aria-hidden className="reward-ready-ring absolute inset-0 rounded-full" />
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(145deg,#ffd978,#f2a91b)] text-white shadow-[0_10px_22px_-8px_rgba(226,150,10,0.9)] ring-4 ring-white">
          <RewardIcon slug={step.slug} size={22} strokeWidth={2.3} aria-hidden />
        </span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        'relative grid h-14 w-14 place-items-center rounded-full ring-4 ring-white',
        next ? 'bg-white text-sk-blue shadow-[0_0_0_3px_var(--color-sk-blue)]' : 'bg-white/80 text-sk-faint',
      )}
    >
      <RewardIcon slug={step.slug} size={21} strokeWidth={2.1} aria-hidden />
      {!next && (
        <span aria-hidden className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-sk-track text-sk-muted ring-2 ring-white">
          <Lock size={10} strokeWidth={2.6} />
        </span>
      )}
    </span>
  );
}

function StepAction({ step, next, balance, pending, onClaim }: { step: MilestoneStep; next: boolean; balance: number; pending: string | null; onClaim: Claim }) {
  if (step.state === 'taken') {
    return <span className="rounded-full bg-sk-success-tint px-2.5 py-1 font-mono text-[10.5px] font-bold text-sk-success">Sudah diklaim</span>;
  }
  if (step.state === 'out_of_stock') {
    return <span className="rounded-full bg-sk-track px-2.5 py-1 font-mono text-[10.5px] font-bold text-sk-muted">Stok habis</span>;
  }
  if (step.state === 'ready') {
    const short = Math.max(0, step.pointsRequired - balance);
    return (
      <span className="flex flex-col items-center gap-1">
        <Button
          size="sm"
          className="h-9 rounded-full px-3.5"
          disabled={short > 0 || pending !== null}
          loading={pending === step.slug}
          onClick={() => onClaim(step.slug, step.retryOf)}
        >
          {step.retryOf ? 'Klaim ulang' : 'Klaim hadiah'}
        </Button>
        {short > 0 && <span className="text-[10.5px] font-semibold text-sk-warning-ink">Saldo kurang {formatPoints(short)}</span>}
      </span>
    );
  }
  return (
    <span className={cn('font-mono text-[10.5px] font-bold', next ? 'text-sk-blue' : 'text-sk-faint')}>
      {next ? `Kurang ${formatPoints(step.deficit)} poin` : 'Terkunci'}
    </span>
  );
}

/**
 * Tangga hadiah — the milestone rewards as one lit staircase.
 *
 * Kept on top and highlighted at the owner's request: this is the ladder every
 * participant climbs, unlocked by points collected (lifetime) and claimed once
 * each with points held (balance). The line fills to exactly where the
 * participant stands between two rewards, so "almost there" is visible, and a
 * claimable step breathes a soft gold ring until it is taken.
 */
export function RewardLadder({
  ladder,
  balance,
  pending,
  onClaim,
}: {
  ladder: MilestoneLadder;
  balance: number;
  pending: string | null;
  onClaim: Claim;
}) {
  const reduce = useSettledReducedMotion();
  const steps = [...ladder.steps].sort((a, b) => a.pointsRequired - b.pointsRequired);
  const fill = trackFill(steps, ladder.lifetimePoints);
  const nextSlug = ladder.next?.slug ?? null;
  const main = steps.at(-1)?.slug;
  const edge = `${50 / steps.length}%`;

  return (
    <div className="-mx-2 overflow-x-auto px-2 pb-2">
      <ol
        aria-label="Tangga hadiah"
        className="relative grid pt-2"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(128px, 1fr))` }}
      >
        <span aria-hidden className="absolute top-[33px] h-1.5 rounded-full bg-white/80 ring-1 ring-black/5" style={{ left: edge, right: edge }}>
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#0f9d58,#f2a91b)]"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${fill * 100}%` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
          />
        </span>
        {steps.map((step, index) => {
          const next = step.slug === nextSlug;
          return (
            <motion.li
              key={step.slug}
              className="relative flex flex-col items-center gap-2 px-1.5 text-center"
              initial={reduce ? false : { opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.25 + index * 0.08 }}
              aria-current={next ? 'step' : undefined}
            >
              {step.slug === main && (
                <span className="absolute -top-2 right-[calc(50%-38px)] z-10 grid h-6 w-6 place-items-center rounded-full bg-[#ffd65c] text-[#9a6a07] shadow-sk-xs ring-2 ring-white" title="Hadiah utama">
                  <Crown size={12} strokeWidth={2.4} aria-hidden />
                </span>
              )}
              <Node step={step} next={next} />
              <span className="font-mono text-[12.5px] font-bold tabular-nums text-sk-navy">{formatPoints(step.pointsRequired)} poin</span>
              <span className="line-clamp-2 min-h-[34px] text-[12.5px] font-semibold leading-snug text-sk-body">{step.title}</span>
              <StepAction step={step} next={next} balance={balance} pending={pending} onClaim={onClaim} />
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
