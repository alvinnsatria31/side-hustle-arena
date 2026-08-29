import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { SkillChip } from '@/components/primitives/SkillChip';
import { Crown, Award, Medal } from 'lucide-react';
import type { WeeklyWinner } from '@/types/winner';
import { cn } from '@/lib/cn';

interface WinnerCardProps {
  winner: WeeklyWinner;
  className?: string;
}

const rankMeta = {
  1: { Icon: Crown, label: 'Featured by Sekolah Karir', tone: 'brand' as const },
  2: { Icon: Award, label: 'Runner Up', tone: 'neutral' as const },
  3: { Icon: Medal, label: 'Runner Up', tone: 'neutral' as const },
};

export function WinnerCard({ winner, className }: WinnerCardProps) {
  const meta = rankMeta[winner.rank];
  const isFirst = winner.rank === 1;
  return (
    <Card
      padding="lg"
      className={cn(
        'h-full flex flex-col',
        isFirst && 'border-[var(--color-brand-200)] bg-gradient-to-br from-[var(--color-brand-50)] to-white',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-9 w-9 rounded-[var(--radius-md)] flex items-center justify-center',
              isFirst ? 'bg-[var(--color-brand-500)] text-white' : 'bg-[var(--color-surface-soft)] text-[var(--color-ink-secondary)]',
            )}
          >
            <meta.Icon className="h-4.5 w-4.5" />
          </div>
          <Badge variant={meta.tone} size="sm">
            #{winner.rank} · {meta.label}
          </Badge>
        </div>
        <span className="text-[20px] font-bold text-[var(--color-ink-primary)] tabular-nums">
          {winner.score}
        </span>
      </div>

      <h3 className={cn('mt-5 font-bold text-[var(--color-ink-primary)] leading-snug tracking-[-0.01em]', isFirst ? 'text-[24px]' : 'text-[18px]')}>
        {winner.projectTitle}
      </h3>
      <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
        {winner.division} · {winner.name}
      </p>

      <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--color-ink-secondary)]">
        {winner.summary}
      </p>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {winner.skills.map((s) => (
          <li key={s}>
            <SkillChip label={s} size="sm" />
          </li>
        ))}
      </ul>

      <div className="mt-5 pt-5 border-t border-[var(--color-border)] flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-[var(--color-brand-500)] text-white text-[12px] font-bold flex items-center justify-center">
          {winner.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-[var(--color-ink-primary)] truncate">
            {winner.name}
          </p>
          <p className="text-[11.5px] text-[var(--color-ink-tertiary)]">Pemenang minggu lalu</p>
        </div>
      </div>
    </Card>
  );
}
