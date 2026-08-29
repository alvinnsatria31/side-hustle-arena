import { Card } from '@/components/primitives/Card';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import type { RubricScore } from '@/types/project';

interface RubricBreakdownProps {
  rubric: RubricScore[];
  className?: string;
}

export function RubricBreakdown({ rubric, className }: RubricBreakdownProps) {
  return (
    <Card padding="lg" className={className}>
      <h3 className="text-[18px] font-semibold text-[var(--color-ink-primary)]">Rubric Breakdown</h3>
      <p className="mt-1 text-[13px] text-[var(--color-ink-tertiary)]">
        Detail skor per aspek penilaian.
      </p>
      <ul className="mt-6 flex flex-col gap-5">
        {rubric.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-semibold text-[var(--color-ink-primary)]">{r.label}</p>
              <span className="text-[14px] font-semibold text-[var(--color-ink-primary)] tabular-nums">
                {r.score}
              </span>
            </div>
            <p className="text-[12.5px] text-[var(--color-ink-tertiary)] mt-0.5">{r.description}</p>
            <div className="mt-2">
              <ProgressBar value={r.score} color="auto" size="md" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
