import { Card } from '@/components/primitives/Card';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import type { CVMetric } from '@/types/cv';

interface ScoreBreakdownProps {
  metrics: CVMetric[];
  className?: string;
}

export function ScoreBreakdown({ metrics, className }: ScoreBreakdownProps) {
  return (
    <Card variant="default" padding="xl" className={className}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[18px] font-semibold text-[var(--color-ink-primary)]">Score Breakdown</h3>
        <span className="text-[12px] text-[var(--color-ink-tertiary)]">5 metrik</span>
      </div>
      <p className="text-[13px] text-[var(--color-ink-tertiary)]">
        Area yang diukur: struktur, dampak konten, kecocokan skill, keterbacaan, dan kesiapan recruiter.
      </p>

      <ul className="mt-6 flex flex-col gap-5">
        {metrics.map((m) => (
          <li key={m.key}>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-[var(--color-ink-primary)]">{m.label}</p>
                <p className="text-[12px] text-[var(--color-ink-tertiary)] mt-0.5">{m.description}</p>
              </div>
              <span className="text-[14px] font-semibold text-[var(--color-ink-primary)] tabular-nums">
                {m.score}
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={m.score} color="auto" size="md" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
