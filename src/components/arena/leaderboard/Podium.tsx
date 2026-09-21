'use client';

import { motion } from 'motion/react';
import { Crown } from 'lucide-react';
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { CountUp } from '@/components/arena/dashboard/CountUp';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { DivisionBadge } from './DivisionBadge';
import { Medal, type MedalTone } from './Medal';
import { cn } from '@/lib/cn';

export interface PodiumEntry {
  rank: number;
  name: string;
  avatarId: string | null;
  division: string | null;
  value: number;
  /** "SKOR" on a weekly board, "POIN" on the all-time one. */
  unit: string;
}

const TONE: Record<number, MedalTone> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

/** Step heights and avatar sizes, per podium size. #1 always stands tallest. */
const SCALE = {
  lg: { step: { 1: 176, 2: 134, 3: 108 }, avatar: { 1: '2xl', 2: 'xl', 3: 'xl' }, medal: 'w-14', badge: 24, gap: 'gap-3 sm:gap-5' },
  md: { step: { 1: 124, 2: 96, 3: 78 }, avatar: { 1: 'xl', 2: 'lg', 3: 'lg' }, medal: 'w-11', badge: 20, gap: 'gap-2 sm:gap-4' },
} as const;

/** Entrance order: #2 rises first, then #3, and the winner last and highest. */
const ORDER_DELAY: Record<number, number> = { 2: 0.05, 3: 0.2, 1: 0.35 };

/**
 * A 3D-looking step: a cylinder body with a lit top ellipse, all CSS, so it
 * scales with the column and costs no image. The body fades into the panel at
 * its foot, which is what makes the steps read as standing on a floor.
 */
function Pedestal({ height, winner }: { height: number; winner: boolean }) {
  return (
    <div className="relative w-full" style={{ height }}>
      <div
        className="absolute inset-x-0 bottom-0 top-[13px] [mask-image:linear-gradient(to_bottom,#000_62%,transparent)]"
        style={{
          background: winner
            ? 'linear-gradient(90deg,#f1bd2f 0%,#ffe078 22%,#fff3c2 44%,#ffd44f 70%,#e9ad1f 100%)'
            : 'linear-gradient(90deg,#f3cb5a 0%,#ffe79d 24%,#fff6d4 46%,#ffe07a 72%,#eebd45 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[27px] rounded-[50%]"
        style={{
          background: winner
            ? 'radial-gradient(ellipse at 50% 38%,#fffbea 0%,#ffe9a3 55%,#f5c63d 100%)'
            : 'radial-gradient(ellipse at 50% 38%,#fffdf2 0%,#fff0bd 55%,#f6d06a 100%)',
          boxShadow: 'inset 0 -3px 6px rgba(190,130,10,0.22), 0 2px 0 rgba(255,255,255,0.6)',
        }}
      />
      <div className="absolute inset-x-[12%] top-[6px] h-[14px] rounded-[50%] border border-white/80" />
    </div>
  );
}

/** Visual order #2 · #1 · #3 while the list itself stays 1, 2, 3 for screen readers. */
const VISUAL_ORDER: Record<number, string> = { 1: 'order-2', 2: 'order-1', 3: 'order-3' };

function Column({ entry, size, reduce }: { entry: PodiumEntry; size: 'lg' | 'md'; reduce: boolean }) {
  const scale = SCALE[size];
  const rank = entry.rank as 1 | 2 | 3;
  const winner = rank === 1;
  const delay = ORDER_DELAY[rank] ?? 0;
  const spring = { type: 'spring' as const, stiffness: 150, damping: 17 };
  const avatarSize = scale.avatar[rank];
  const decimals = Number.isInteger(entry.value) ? 0 : 1;

  return (
    <li className={cn('relative flex min-w-0 flex-1 flex-col items-center', VISUAL_ORDER[rank])}>
      {winner && (
        <>
          <span
            aria-hidden
            className="podium-glow pointer-events-none absolute -top-6 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,196,40,0.55),transparent_68%)] blur-lg"
          />
          {[
            'left-[14%] top-[6%]',
            'right-[12%] top-[2%]',
            'left-[8%] top-[30%]',
            'right-[6%] top-[26%]',
          ].map((spot, i) => (
            <span
              key={spot}
              aria-hidden
              className={cn('podium-sparkle pointer-events-none absolute text-[#f2b21b]', spot)}
              style={{ animationDelay: `${0.9 + i * 1.1}s` }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z" fill="currentColor" /></svg>
            </span>
          ))}
        </>
      )}

      <motion.div
        className="relative flex flex-col items-center"
        initial={reduce ? false : { opacity: 0, scale: 0.55, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ ...spring, delay: delay + 0.35 }}
      >
        {winner && (
          <motion.span
            aria-hidden
            className="crown-bob mb-0.5 text-[#e8a50c]"
            initial={reduce ? false : { opacity: 0, y: -10, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: delay + 0.6 }}
          >
            <Crown size={size === 'lg' ? 26 : 20} fill="#ffd54a" strokeWidth={1.8} />
          </motion.span>
        )}
        <span className="relative transition-transform duration-300 hover:scale-105">
          <AvatarBadge
            avatarId={entry.avatarId}
            seed={entry.name}
            size={avatarSize}
            className={cn('ring-4 ring-white shadow-[0_10px_24px_-10px_rgba(120,80,10,0.5)]')}
          />
          <DivisionBadge division={entry.division} size={scale.badge} className="absolute -right-0.5 -top-0.5" />
        </span>
      </motion.div>

      <motion.div
        className="mt-2 flex w-full flex-col items-center gap-1.5 px-1 text-center"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: delay + 0.5 }}
      >
        <span className={cn('max-w-full truncate font-bold text-sk-navy', winner ? 'text-[15px]' : 'text-[13.5px]')}>{entry.name}</span>
        <span className="inline-flex items-baseline gap-1 rounded-full bg-sk-navy px-2.5 py-1 font-mono text-white shadow-sk-xs">
          <span className="text-[9.5px] font-semibold tracking-[0.08em] text-white/70">{entry.unit}</span>
          <span className={cn('font-bold tabular-nums', winner ? 'text-[14px]' : 'text-[13px]')}>
            <CountUp value={entry.value} from={0} duration={1100} decimals={decimals} />
          </span>
        </span>
      </motion.div>

      <div className="relative mt-3 w-full">
        <motion.div
          className={cn('absolute left-1/2 z-10 -translate-x-1/2', scale.medal)}
          style={{ top: -10 }}
          initial={reduce ? false : { opacity: 0, y: -36, rotate: -24 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 13, delay: delay + 0.28 }}
        >
          <Medal tone={TONE[rank]} className="w-full" />
        </motion.div>
        <motion.div
          style={{ transformOrigin: 'bottom' }}
          initial={reduce ? false : { scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 110, damping: 18, delay }}
        >
          <Pedestal height={scale.step[rank]} winner={winner} />
        </motion.div>
      </div>
    </li>
  );
}

/**
 * The top three, as a stage: #2 left, #1 centre and tallest, #3 right.
 *
 * The entrance is choreographed rather than faded: the steps rise in the
 * order #2, #3, #1, each medal drops onto its step, then the portraits pop in
 * and the scores count up — so the eye lands on the winner last, the way a
 * real podium ceremony does. After that only two quiet loops remain on #1, a
 * breathing glow and an occasional sparkle; everything else holds still.
 */
export function Podium({ entries, size = 'lg', label }: { entries: PodiumEntry[]; size?: 'lg' | 'md'; label: string }) {
  const reduce = useSettledReducedMotion();
  const stage = entries.filter((entry) => entry.rank >= 1 && entry.rank <= 3).sort((a, b) => a.rank - b.rank);
  if (!stage.length) return null;
  return (
    <ol aria-label={label} className={cn('mx-auto flex w-full max-w-[560px] items-end', SCALE[size].gap)}>
      {stage.map((entry) => (
        <Column key={`${entry.rank}-${entry.name}`} entry={entry} size={size} reduce={reduce} />
      ))}
    </ol>
  );
}
