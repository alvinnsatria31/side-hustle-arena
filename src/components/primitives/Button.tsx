import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-[var(--radius-sm)] transition-colors transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-[var(--color-brand-500)] focus-visible:outline-offset-2 whitespace-nowrap';

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-4 text-[14px]',
  lg: 'h-12 px-5 text-[15px]',
};

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-brand-500)] text-white hover:bg-[var(--color-brand-600)] shadow-[0_1px_2px_rgba(13,25,48,0.04),0_4px_12px_rgba(20,99,255,0.18)]',
  secondary:
    'bg-white text-[var(--color-ink-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-soft)]',
  ghost: 'bg-transparent text-[var(--color-ink-primary)] hover:bg-[var(--color-surface-soft)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:bg-[#B83838]',
  outline:
    'bg-transparent text-[var(--color-brand-500)] border border-[var(--color-brand-500)] hover:bg-[var(--color-brand-50)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    loading,
    iconLeft,
    iconRight,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white anim-spin" />
      ) : (
        iconLeft
      )}
      <span>{children}</span>
      {iconRight}
    </button>
  );
});
