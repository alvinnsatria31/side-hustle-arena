import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
  iconLeft?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, iconLeft, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `input-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-[var(--color-ink-primary)]">
          {label}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-tertiary)]">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3.5 text-[14px] text-[var(--color-ink-primary)] placeholder:text-[var(--color-ink-muted)] transition-colors',
            'focus:border-[var(--color-brand-500)] focus:outline-none focus:ring-3 focus:ring-[var(--color-brand-50)]',
            !!iconLeft && 'pl-10',
            error && 'border-[var(--color-danger)]',
            className,
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
      ) : helper ? (
        <p className="text-[12px] text-[var(--color-ink-tertiary)]">{helper}</p>
      ) : null}
    </div>
  );
});
