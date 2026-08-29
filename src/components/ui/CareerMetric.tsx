import { Card } from '@/components/primitives/Card';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

interface CareerMetricProps {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  tone?: 'default' | 'brand';
  className?: string;
}

export function CareerMetric({ label, value, sublabel, icon, tone = 'default', className }: CareerMetricProps) {
  return (
    <Card
      padding="md"
      className={cn(tone === 'brand' && 'bg-[var(--color-brand-50)] border-[var(--color-brand-100)]', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-tertiary)]">
            {label}
          </p>
          <p className="mt-2 text-[24px] font-bold text-[var(--color-ink-primary)] tabular-nums tracking-[-0.01em]">
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 text-[12px] text-[var(--color-ink-tertiary)]">{sublabel}</p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'h-9 w-9 shrink-0 rounded-[var(--radius-md)] flex items-center justify-center',
              tone === 'brand'
                ? 'bg-white text-[var(--color-brand-600)]'
                : 'bg-[var(--color-surface-soft)] text-[var(--color-ink-secondary)]',
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
