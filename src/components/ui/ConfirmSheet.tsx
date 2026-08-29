'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { cn } from '@/lib/cn';

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  warning?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  children?: React.ReactNode;
}

export function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  warning,
  primaryLabel,
  secondaryLabel = 'Kembali',
  onPrimary,
  onSecondary,
  children,
}: ConfirmSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(13,25,48,0.45)] anim-fade-in"
      />
      {/* Desktop centered modal */}
      <div className="hidden md:flex absolute inset-0 items-center justify-center p-4">
        <div className="relative w-full max-w-[460px] rounded-[var(--radius-xl)] bg-white shadow-[var(--shadow-pop)] p-6 anim-scale-in">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 h-8 w-8 rounded-full text-[var(--color-ink-tertiary)] hover:bg-[var(--color-surface-soft)] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="text-[20px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em] pr-8">
            {title}
          </h3>
          {description && (
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
              {description}
            </p>
          )}
          {children && <div className="mt-4">{children}</div>}
          {warning && (
            <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-[12.5px] text-[var(--color-warning)] font-medium">
              {warning}
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                onSecondary?.();
                onClose();
              }}
              fullWidth
              className="sm:w-auto"
            >
              {secondaryLabel}
            </Button>
            <Button
              variant="primary"
              onClick={onPrimary}
              fullWidth
              className="sm:w-auto"
            >
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div className="md:hidden absolute inset-x-0 bottom-0">
        <div className="rounded-t-[var(--radius-xl)] bg-white shadow-[var(--shadow-pop)] p-5 safe-bottom anim-fade-up">
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-border-strong)] mb-4" />
          <h3 className="text-[20px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em] pr-8">
            {title}
          </h3>
          {description && (
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
              {description}
            </p>
          )}
          {children && <div className="mt-4">{children}</div>}
          {warning && (
            <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-[12.5px] text-[var(--color-warning)] font-medium">
              {warning}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button variant="primary" onClick={onPrimary} fullWidth>
              {primaryLabel}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onSecondary?.();
                onClose();
              }}
              fullWidth
            >
              {secondaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
