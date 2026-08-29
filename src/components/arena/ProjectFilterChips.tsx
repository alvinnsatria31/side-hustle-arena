'use client';

import { cn } from '@/lib/cn';
import type { ProjectDivision } from '@/types/project';

interface ProjectFilterChipsProps {
  options: Array<{ value: 'Semua' | ProjectDivision; label: string }>;
  value: 'Semua' | ProjectDivision;
  onChange: (v: 'Semua' | ProjectDivision) => void;
  className?: string;
}

export function ProjectFilterChips({ options, value, onChange, className }: ProjectFilterChipsProps) {
  return (
    <div
      className={cn(
        'no-scrollbar flex gap-2 overflow-x-auto -mx-1 px-1 pb-1',
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'shrink-0 h-9 px-4 rounded-[var(--radius-pill)] text-[13px] font-semibold border transition-colors',
              active
                ? 'bg-[var(--color-brand-500)] text-white border-[var(--color-brand-500)]'
                : 'bg-white text-[var(--color-ink-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-soft)]',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
