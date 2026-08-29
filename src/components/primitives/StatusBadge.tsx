import { Badge } from './Badge';
import { cn } from '@/lib/cn';

export type StatusTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
}

const dotColors: Record<StatusTone, string> = {
  neutral: 'bg-[var(--color-ink-tertiary)]',
  brand: 'bg-[var(--color-brand-500)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
};

export function StatusBadge({ label, tone = 'neutral', dot, className }: StatusBadgeProps) {
  return (
    <Badge variant={tone} size="sm" className={cn('tracking-normal normal-case', className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[tone])} />}
      <span className="text-[12px] font-semibold">{label}</span>
    </Badge>
  );
}
