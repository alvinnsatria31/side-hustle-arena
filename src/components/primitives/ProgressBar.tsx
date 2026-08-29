import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number; // 0..100
  className?: string;
  color?: 'brand' | 'success' | 'warning' | 'danger' | 'auto';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

function autoColor(value: number): 'success' | 'warning' | 'danger' {
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'danger';
}

const trackColors: Record<string, string> = {
  brand: 'bg-[var(--color-brand-50)]',
  success: 'bg-[var(--color-success-soft)]',
  warning: 'bg-[var(--color-warning-soft)]',
  danger: 'bg-[var(--color-danger-soft)]',
};

const fillColors: Record<string, string> = {
  brand: 'bg-[var(--color-brand-500)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
};

const heights: Record<string, string> = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-2.5',
};

export function ProgressBar({
  value,
  className,
  color = 'auto',
  size = 'md',
  showValue = false,
}: ProgressBarProps) {
  const resolved = color === 'auto' ? autoColor(value) : color;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('flex items-center gap-3 w-full', className)}>
      <div className={cn('flex-1 rounded-full overflow-hidden', trackColors[resolved], heights[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', fillColors[resolved])}
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showValue && (
        <span className="text-[12px] font-semibold text-[var(--color-ink-secondary)] tabular-nums w-9 text-right">
          {clamped}
        </span>
      )}
    </div>
  );
}
