import { Banknote, BookOpen, Check, Crown, Gift, GraduationCap, LayoutTemplate, TicketPercent, UserCheck, type LucideIcon } from 'lucide-react';
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

function iconFor(step: RoadmapStep): LucideIcon {
  return ICON_BY_SLUG[step.slug] ?? (step.rewardType ? ICON_BY_TYPE[step.rewardType] : undefined) ?? Gift;
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
            <span>{progress.reachedCount}/{progress.total} milestone terbuka</span>
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
                <span className="font-mono text-[10.5px] tracking-[0.08em] text-sk-muted">MILESTONE {index + 1}</span>
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

/**
 * The participant's own numbers: points collected, the gap to the next reward,
 * and the gap to the main reward, each with a progress bar.
 */
export function RewardProgress({ lifetimePoints, balance, steps, className }: {
  lifetimePoints: number;
  /** Spendable points. Shown separately: claiming spends balance, not progress. */
  balance?: number | null;
  steps: RoadmapStep[];
  className?: string;
}) {
  const progress = rewardProgress(lifetimePoints, steps);
  if (!progress.total) return null;
  const showMain = progress.main && !progress.mainReached && progress.main.slug !== progress.next?.slug;
  return (
    <div className={cn('rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-sk-muted">Poin terkumpul</p>
          <p className="mt-1 text-3xl font-extrabold text-sk-navy">{formatPoints(progress.points)} <span className="text-base font-bold text-sk-muted">poin</span></p>
        </div>
        {typeof balance === 'number' && (
          <p className="text-xs text-sk-muted">Saldo bisa ditukar: <strong className="text-sk-blue">{formatPoints(balance)} poin</strong></p>
        )}
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-[13px] leading-relaxed text-sk-body">
            {progress.next
              ? <>Kurang <strong className="text-sk-navy">{formatPoints(progress.next.remaining)} poin</strong> lagi untuk membuka <strong className="text-sk-navy">{progress.next.title}</strong> ({formatPoints(progress.next.pointsRequired)} poin).</>
              : <>Semua milestone sudah terbuka. Tukarkan poinmu di bawah.</>}
          </p>
          {progress.next && (
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar value={progress.next.percent} className="h-2 flex-1" />
              <span className="w-10 shrink-0 text-right font-mono text-xs text-sk-muted">{progress.next.percent}%</span>
            </div>
          )}
        </div>
        {progress.main && (
          <div>
            <p className="text-[13px] leading-relaxed text-sk-body">
              {progress.mainReached
                ? <>Hadiah utama <strong className="text-sk-navy">{progress.main.title}</strong> sudah terbuka.</>
                : showMain
                  ? <>Kurang <strong className="text-sk-navy">{formatPoints(progress.main.remaining)} poin</strong> lagi untuk mencapai <strong className="text-sk-navy">{progress.main.title}</strong> ({formatPoints(progress.main.pointsRequired)} poin).</>
                  : <>Hadiah berikutnya adalah hadiah utama.</>}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar value={progress.main.percent} className="h-2 flex-1" />
              <span className="w-10 shrink-0 text-right font-mono text-xs text-sk-muted">{progress.main.percent}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
