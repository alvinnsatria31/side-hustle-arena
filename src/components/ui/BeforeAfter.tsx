import { Card } from '@/components/primitives/Card';
import type { BeforeAfterExample } from '@/types/cv';

interface BeforeAfterProps {
  example: BeforeAfterExample;
  className?: string;
}

export function BeforeAfter({ example, className }: BeforeAfterProps) {
  return (
    <Card padding="lg" className={className}>
      <h3 className="text-[18px] font-semibold text-[var(--color-ink-primary)]">Contoh perbaikan bullet</h3>
      <p className="mt-1 text-[13px] text-[var(--color-ink-tertiary)]">
        Perbedaan antara bullet task-oriented dan outcome-driven.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-tertiary)]">
            Before
          </span>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
            {example.before}
          </p>
        </div>
        <div className="relative rounded-[var(--radius-md)] border border-[var(--color-brand-200)] bg-[var(--color-brand-50)] p-5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
            After
          </span>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-primary)] font-medium">
            {example.after}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--color-ink-tertiary)]">
        <span className="font-semibold text-[var(--color-ink-primary)]">Kenapa lebih kuat: </span>
        {example.rationale}
      </p>
    </Card>
  );
}
