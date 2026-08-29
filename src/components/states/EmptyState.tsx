import { cn } from '@/lib/cn';
import { Button } from '@/components/primitives/Button';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, cta, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-card)]',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-500)]">
          {icon}
        </div>
      )}
      <h3 className="text-[18px] font-semibold text-[var(--color-ink-primary)] max-w-md">{title}</h3>
      {description && (
        <p className="mt-2 text-[14px] text-[var(--color-ink-tertiary)] max-w-md">{description}</p>
      )}
      {cta && (
        <div className="mt-6">
          {cta.href ? (
            <a href={cta.href}>
              <Button variant="primary">{cta.label}</Button>
            </a>
          ) : (
            <Button onClick={cta.onClick} variant="primary">
              {cta.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
