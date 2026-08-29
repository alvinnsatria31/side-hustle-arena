import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/primitives/Button';

interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-card)]',
        className,
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">{title}</h3>
      {description && (
        <p className="mt-1.5 text-[13px] text-[var(--color-ink-tertiary)] max-w-md">{description}</p>
      )}
      {onRetry && (
        <div className="mt-5">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Coba lagi
          </Button>
        </div>
      )}
    </div>
  );
}
