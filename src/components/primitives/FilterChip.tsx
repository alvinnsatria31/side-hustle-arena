'use client';

import { cn } from '@/lib/cn';

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}

export function FilterChip({ label, active, onClick, count }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition-all duration-200',
        active
          ? 'border-sk-navy bg-sk-navy text-white'
          : 'border-sk-border bg-white text-sk-body hover:border-sk-blue/40 hover:text-sk-navy',
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn('font-mono text-[10.5px]', active ? 'text-white/60' : 'text-sk-faint')}>
          {count}
        </span>
      )}
    </button>
  );
}
