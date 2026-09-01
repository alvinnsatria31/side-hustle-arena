'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-11 w-full rounded-[var(--radius-sk-md)] border bg-white px-4 text-[13.5px] text-sk-navy placeholder:text-sk-muted',
        'transition-colors duration-200 focus:outline-none',
        invalid
          ? 'border-sk-error bg-sk-error-wash focus:border-sk-error'
          : 'border-sk-border focus:border-sk-blue focus:bg-sk-blue-wash focus:shadow-[0_0_0_4px_rgba(36,107,253,0.08)]',
        className,
      )}
      {...rest}
    />
  );
});
