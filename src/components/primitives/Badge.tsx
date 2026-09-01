import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'blue' | 'mint' | 'amber' | 'slate' | 'recommended' | 'dark';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  blue: 'bg-sk-blue-tint text-sk-blue',
  mint: 'bg-sk-success-tint text-sk-success',
  amber: 'bg-sk-warning-tint text-sk-warning-ink',
  slate: 'bg-sk-track text-sk-muted',
  recommended:
    'bg-gradient-to-r from-sk-blue to-sk-blue-400 text-white shadow-[0_6px_16px_-6px_rgba(36,107,253,0.6)]',
  dark: 'bg-white/10 text-white border border-white/15',
};

/** Mono pill — the approved badge style. */
export function Badge({ variant = 'blue', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold leading-none',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
