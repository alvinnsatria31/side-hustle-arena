import { ProgressBar } from '@/components/primitives/ProgressBar';

interface SkillBarProps {
  label: string;
  score: number;
  highlight?: boolean;
}

export function SkillBar({ label, score, highlight }: SkillBarProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[14px] ${highlight ? 'font-semibold text-[var(--color-ink-primary)]' : 'font-medium text-[var(--color-ink-primary)]'}`}
          >
            {label}
          </span>
          {highlight && (
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-brand-600)]">
              Best
            </span>
          )}
        </div>
        <div className="mt-2">
          <ProgressBar value={score} color="brand" size="md" />
        </div>
      </div>
      <span className="text-[14px] font-semibold text-[var(--color-ink-primary)] tabular-nums w-10 text-right">
        {score}
      </span>
    </div>
  );
}
