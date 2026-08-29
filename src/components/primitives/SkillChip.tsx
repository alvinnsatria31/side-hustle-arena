import { cn } from '@/lib/cn';

interface SkillChipProps {
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function SkillChip({ label, size = 'md', className }: SkillChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-ink-secondary)] font-medium',
        size === 'sm' ? 'h-6 px-2.5 text-[11px]' : 'h-7 px-3 text-[12px]',
        className,
      )}
    >
      {label}
    </span>
  );
}
