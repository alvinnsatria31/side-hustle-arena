'use client';

import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DeliverableChecklistProps {
  items: Array<{ id: string; title: string; description?: string; done?: boolean }>;
  onToggle?: (id: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function DeliverableChecklist({
  items,
  onToggle,
  readOnly,
  className,
}: DeliverableChecklistProps) {
  const completed = items.filter((i) => i.done).length;
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Deliverables</h3>
        <span className="text-[12px] text-[var(--color-ink-tertiary)] tabular-nums">
          {completed}/{items.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => {
          const interactive = !readOnly && !!onToggle;
          return (
            <li key={it.id}>
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onToggle?.(it.id)}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-[var(--radius-md)] border text-left transition-colors',
                  it.done
                    ? 'bg-[var(--color-success-soft)] border-transparent'
                    : 'bg-white border-[var(--color-border)] hover:bg-[var(--color-surface-soft)]',
                  !interactive && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center',
                    it.done ? 'bg-[var(--color-success)] text-white' : 'border border-[var(--color-border-strong)] text-transparent',
                  )}
                >
                  {it.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle className="h-3.5 w-3.5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-[13.5px] font-semibold leading-snug',
                      it.done ? 'text-[var(--color-ink-primary)]' : 'text-[var(--color-ink-primary)]',
                    )}
                  >
                    {it.title}
                  </p>
                  {it.description && (
                    <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-tertiary)] leading-relaxed">
                      {it.description}
                    </p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
