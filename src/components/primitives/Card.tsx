import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Solid white content surface (panels stay solid; glass is for floating widgets only). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white', className)}
      {...rest}
    />
  );
}

/** Mono micro-heading used inside panels (e.g. "YANG SUDAH KUAT"). */
export function PanelHeading({
  children,
  pin,
  className,
}: {
  children: React.ReactNode;
  pin?: 'g' | 'a' | 'b';
  className?: string;
}) {
  return (
    <h4
      className={cn(
        'mb-4 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted',
        className,
      )}
    >
      {pin && (
        <span
          aria-hidden
          className={cn(
            'h-2 w-2 rounded-full',
            pin === 'g' && 'bg-sk-success',
            pin === 'a' && 'bg-sk-warning',
            pin === 'b' && 'bg-sk-blue',
          )}
        />
      )}
      {children}
    </h4>
  );
}
