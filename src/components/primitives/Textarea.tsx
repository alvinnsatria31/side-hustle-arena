'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full rounded-[var(--radius-sk-md)] border bg-white px-4 py-3 text-[13.5px] leading-relaxed text-sk-navy placeholder:text-sk-muted',
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
