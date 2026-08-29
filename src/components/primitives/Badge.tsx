import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

type Variant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'outline' | 'soft';
type Size = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  neutral: 'bg-[var(--color-surface-soft)] text-[var(--color-ink-secondary)] border border-[var(--color-border)]',
  brand: 'bg-[var(--color-brand-50)] text-[var(--color-brand-700)] border border-[var(--color-brand-100)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-transparent',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-transparent',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-transparent',
  outline: 'bg-white text-[var(--color-ink-secondary)] border border-[var(--color-border)]',
  soft: 'bg-white text-[var(--color-ink-primary)] border border-[var(--color-border)]',
};

const sizes: Record<Size, string> = {
  sm: 'h-6 px-2 text-[11px]',
  md: 'h-7 px-2.5 text-[12px]',
};

export function Badge({
  variant = 'neutral',
  size = 'sm',
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-pill)] font-semibold tracking-[0.02em] uppercase',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
