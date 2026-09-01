'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ChecklistRowProps {
  label: string;
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  mandatory?: boolean;
}

/** Animated checklist row (workspace review + submit final checklist). */
export function ChecklistRow({ label, checked, onToggle, disabled, mandatory }: ChecklistRowProps) {
  const reduce = useReducedMotion();
  const interactive = Boolean(onToggle) && !disabled;

  const content = (
    <>
      <motion.span
        animate={checked && !reduce ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.3 }}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-200',
          checked ? 'border-sk-success bg-sk-success text-white' : 'border-sk-blue-tint-border bg-white',
          interactive && !checked && 'group-hover:border-sk-blue',
        )}
        aria-hidden
      >
        {checked && <Check size={13} strokeWidth={3.5} />}
      </motion.span>
      <span
        className={cn(
          'text-[14px] transition-colors',
          checked ? 'text-sk-navy' : 'text-sk-body',
        )}
      >
        {label}
        {mandatory && !checked && <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-sk-warning-ink">wajib</span>}
      </span>
    </>
  );

  if (!interactive) {
    return (
      <div className="flex items-center gap-3 py-1">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-lg py-2.5 pl-2 pr-3 text-left transition-colors hover:bg-sk-bg disabled:opacity-60"
    >
      {content}
    </button>
  );
}
