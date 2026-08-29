import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'default' | 'soft' | 'bordered' | 'elevated';
type Padding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  interactive?: boolean;
}

const variants: Record<Variant, string> = {
  default:
    'bg-[var(--color-surface-card)] border border-[var(--color-border)] shadow-[var(--shadow-card)]',
  soft:
    'bg-[var(--color-surface-soft)] border border-transparent',
  bordered:
    'bg-[var(--color-surface-card)] border border-[var(--color-border)]',
  elevated:
    'bg-[var(--color-surface-card)] border border-[var(--color-border)] shadow-[var(--shadow-card-hover)]',
};

const paddings: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
  xl: 'p-8',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'md', interactive, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--radius-lg)]',
        variants[variant],
        paddings[padding],
        interactive && 'transition-shadow hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
