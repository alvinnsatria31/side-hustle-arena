import { createElement } from 'react';
import { Banknote, BookOpen, Check, Crown, Gift, GraduationCap, LayoutTemplate, TicketPercent, UserCheck, type LucideIcon, type LucideProps } from 'lucide-react';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { formatPoints, rewardProgress } from '@/lib/reward-progress';
import { cn } from '@/lib/cn';

/**
 * The reward ladder, drawn in order: 300 → 600 → 1.000 → 1.500 → 2.200 →
 * 2.700 points, the last one being the main reward.
 *
 * No hooks, so the public Arena page can render it on the server from the
 * catalog alone, and the participant pages can pass their own ladder to mark
 * what is reached, claimable or taken.
 */

export type RoadmapState = 'locked' | 'ready' | 'taken' | 'out_of_stock';

export interface RoadmapStep {
  slug: string;
  title: string;
  pointsRequired: number;
  rewardType?: string | null;
  state?: RoadmapState;
}

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  'notion-kit': LayoutTemplate,
  ebook: BookOpen,
  'voucher-50': TicketPercent,
  'cv-review': UserCheck,
  'free-pass': GraduationCap,
  'cash-500k': Banknote,
};

const ICON_BY_TYPE: Record<string, LucideIcon> = {
  DIGITAL: BookOpen,
  DISCOUNT: TicketPercent,
  SERVICE: UserCheck,
  MASTERCLASS: GraduationCap,
  MONETARY: Banknote,
};

export function rewardIconFor(slug: string, rewardType?: string | null): LucideIcon {
  return ICON_BY_SLUG[slug] ?? (rewardType ? ICON_BY_TYPE[rewardType] : undefined) ?? Gift;
}

/** A reward's icon as an element, for surfaces that render one per reward. */
export function RewardIcon({ slug, rewardType, ...props }: { slug: string; rewardType?: string | null } & LucideProps) {
  return createElement(rewardIconFor(slug, rewardType), props);
}

function iconFor(step: RoadmapStep): LucideIcon {
  return rewardIconFor(step.slug, step.rewardType);
}

const STATE_LABEL: Record<RoadmapState, string> = {
  taken: 'Sudah diklaim',
  ready: 'Siap diklaim',
  out_of_stock: 'Stok habis',
  locked: '',
};

export function MilestoneRoadmap({ steps, points, className }: {
  steps: RoadmapStep[];
  /** Lifetime points, when the viewer is a participant. Omit on public pages. */
  points?: number | null;
  className?: string;
}) {
  const sorted = [...steps].sort((a, b) => a.pointsRequired - b.pointsRequired || a.slug.localeCompare(b.slug));
  if (!sorted.length) return null;
  const personal = typeof points === 'number';
  const progress = rewardProgress(points ?? 0, sorted);
  const main = sorted[sorted.length - 1];

  return (
    <div className={className}>
      {personal && progress.main && (
        <div className="mb-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-sk-muted">
            <span>
              <strong className="text-sk-navy">{formatPoints(progress.points)} poin</strong> dari {formatPoints(progress.main.pointsRequired)} poin hadiah utama
            </span>
            <span>{progress.reachedCount}/{progress.total} hadiah terbuka</span>
          </div>
          <ProgressBar value={progress.main.percent} className="h-2" />
        </div>
      )}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {sorted.map((step, index) => {
          const Icon = iconFor(step);
          const isMain = step.slug === main.slug;
          const reached = personal && (step.state === 'taken' || (points ?? 0) >= step.pointsRequired);
          const isNext = personal && progress.next?.slug === step.slug;
          const status = step.state && step.state !== 'locked'
            ? STATE_LABEL[step.state]
            : isNext
              ? `Kurang ${formatPoints(progress.next!.remaining)} poin`
              : '';
          return (
            <li
              key={step.slug}
              className={cn(
                'relative flex flex-col gap-2 rounded-[var(--radius-sk-lg)] border bg-white p-4',
                isMain ? 'border-sk-blue shadow-sk-glass' : 'border-sk-border',
                isNext && !isMain && 'ring-2 ring-sk-blue-tint',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  aria-hidden
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    reached ? 'bg-sk-blue text-white' : isNext ? 'bg-sk-blue-wash text-sk-blue' : 'bg-sk-bg text-sk-muted',
                  )}
                >
                  {reached && step.state === 'taken' ? <Check size={18} strokeWidth={2.6} /> : <Icon size={18} />}
                </span>
                <span className="font-mono text-[10.5px] tracking-[0.08em] text-sk-muted">HADIAH {index + 1}</span>
              </div>
              <p className="text-[15px] font-extrabold text-sk-navy">{formatPoints(step.pointsRequired)} poin</p>
              <p className="text-[13px] leading-snug text-sk-body">{step.title}</p>
              {isMain && (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-sk-blue px-2 py-0.5 text-[10.5px] font-bold text-white">
                  <Crown size={11} aria-hidden /> Hadiah utama
                </span>
              )}
              {status && <p className={cn('mt-auto text-[11.5px] font-semibold', step.state === 'ready' ? 'text-sk-success' : 'text-sk-muted')}>{status}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
