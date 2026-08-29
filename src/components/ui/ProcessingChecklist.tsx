'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ProcessingStep {
  id: string;
  label: string;
  detail?: string;
}

interface ProcessingChecklistProps {
  steps: ProcessingStep[];
  currentIndex: number; // 0..steps.length (all done when === steps.length)
}

export function ProcessingChecklist({ steps, currentIndex }: ProcessingChecklistProps) {
  return (
    <ol className="flex flex-col gap-2.5" aria-live="polite">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <li
            key={step.id}
            className={cn(
              'flex items-center gap-3 h-11 px-3.5 rounded-[var(--radius-sm)] border transition-colors',
              isDone && 'bg-[var(--color-surface-soft)] border-transparent',
              isCurrent && 'bg-[var(--color-brand-50)] border-[var(--color-brand-100)]',
              !isDone && !isCurrent && 'bg-white border-[var(--color-border)]',
            )}
          >
            <span
              className={cn(
                'h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold',
                isDone && 'bg-[var(--color-success)] text-white',
                isCurrent && 'bg-[var(--color-brand-500)] text-white anim-pulse-ring',
                !isDone && !isCurrent && 'bg-[var(--color-surface-soft)] text-[var(--color-ink-tertiary)]',
              )}
              aria-hidden
            >
              {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                'text-[14px] font-medium',
                isDone && 'text-[var(--color-ink-tertiary)]',
                isCurrent && 'text-[var(--color-ink-primary)] font-semibold',
                !isDone && !isCurrent && 'text-[var(--color-ink-tertiary)]',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
