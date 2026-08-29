import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, className, id, ...rest },
  ref,
) {
  const tid = id ?? `ta-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={tid} className="text-[13px] font-semibold text-[var(--color-ink-primary)]">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={tid}
        className={cn(
          'min-h-24 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3.5 py-3 text-[14px] leading-relaxed text-[var(--color-ink-primary)] placeholder:text-[var(--color-ink-muted)] transition-colors',
          'focus:border-[var(--color-brand-500)] focus:outline-none focus:ring-3 focus:ring-[var(--color-brand-50)]',
          error && 'border-[var(--color-danger)]',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
      ) : helper ? (
        <p className="text-[12px] text-[var(--color-ink-tertiary)]">{helper}</p>
      ) : null}
    </div>
  );
});
