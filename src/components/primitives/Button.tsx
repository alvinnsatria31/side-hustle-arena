import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'ghostOnDark' | 'text' | 'destructive' | 'white';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-[var(--radius-sk-md)] whitespace-nowrap transition-all duration-200 ease-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2';

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[12.5px]',
  md: 'h-11 px-5 text-[13.5px]',
  lg: 'h-12 px-6 text-[14.5px]',
};

const variants: Record<Variant, string> = {
  primary:
    'bg-sk-blue text-white shadow-sk-btn hover:bg-sk-blue-700 hover:-translate-y-px',
  ghost:
    'bg-transparent text-sk-navy border border-sk-navy/12 hover:bg-white hover:shadow-sk-xs',
  ghostOnDark:
    'bg-white/10 text-white border border-white/20 hover:bg-white/20',
  text: 'bg-transparent text-sk-blue px-0 hover:text-sk-blue-700 hover:underline underline-offset-4 disabled:no-underline',
  destructive: 'bg-sk-error text-white hover:bg-[#a83722]',
  white: 'bg-white text-sk-blue shadow-md hover:-translate-y-px hover:shadow-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, loading, iconLeft, iconRight, className, children, disabled, ...rest },
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
        <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white anim-spin" aria-hidden />
      ) : (
        iconLeft
      )}
      <span>{children}</span>
      {iconRight}
    </button>
  );
});

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

/** Anchor styled as a button (Next.js Link). */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(base, sizes[size], variants[variant], fullWidth && 'w-full', className)}
      {...rest}
    >
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </Link>
  );
}
