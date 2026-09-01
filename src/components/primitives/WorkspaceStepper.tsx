'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { WORKSPACE_STEP_LABELS } from './StatusBadge';
import type { WorkspaceStep } from '@/types/project';

const ORDER: WorkspaceStep[] = ['brief', 'plan', 'work', 'review', 'submit'];

interface WorkspaceStepperProps {
  current: WorkspaceStep;
  completedUpTo?: number; // steps fully completed (index-based, 0..4)
  onStepClick?: (step: WorkspaceStep) => void;
}

/** Horizontal 5-step progress bar for the workspace (animated forward). */
export function WorkspaceStepper({ current, completedUpTo, onStepClick }: WorkspaceStepperProps) {
  const reduce = useReducedMotion();
  const currentIndex = ORDER.indexOf(current);
  const doneCount = completedUpTo ?? Math.max(0, currentIndex);

  return (
    <div className="flex flex-wrap items-center gap-y-3 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white px-4 py-3.5 sm:px-6">
      {ORDER.map((step, i) => {
        const done = i < doneCount;
        const now = i === currentIndex;
        return (
          <div key={step} className={cn('flex items-center', i < ORDER.length - 1 && 'flex-1')}>
            <button
              type="button"
              onClick={onStepClick ? () => onStepClick(step) : undefined}
              disabled={!onStepClick || i > currentIndex}
              aria-current={now ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2.5 text-[13px] font-semibold transition-colors',
                done && 'text-sk-success',
                now && 'text-sk-blue',
                !done && !now && 'text-sk-muted',
                onStepClick && i <= currentIndex ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold transition-all duration-300',
                  done && 'bg-sk-success-tint text-sk-success',
                  now && 'bg-sk-blue text-white shadow-[0_0_0_4px_rgba(36,107,253,0.15)]',
                  !done && !now && 'bg-sk-track text-sk-muted',
                )}
              >
                {done ? (
                  <motion.span
                    initial={reduce ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="flex"
                  >
                    <Check size={13} strokeWidth={3} aria-hidden />
                  </motion.span>
                ) : (
                  i + 1
                )}
              </span>
              <span className="hidden md:inline">{WORKSPACE_STEP_LABELS[step]}</span>
              <span className="md:hidden">{WORKSPACE_STEP_LABELS[step].split(' ')[0]}</span>
            </button>
            {i < ORDER.length - 1 && (
              <span aria-hidden className="mx-3 hidden h-0.5 max-w-[60px] flex-1 rounded-full bg-sk-border sm:block">
                <motion.span
                  className="block h-full rounded-full bg-sk-mint"
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
