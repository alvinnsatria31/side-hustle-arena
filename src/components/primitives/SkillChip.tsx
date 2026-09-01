import { cn } from '@/lib/cn';

/** Mono skill tag (light and on-dark variants). */
export function SkillChip({ children, className, dark }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 font-mono text-[11px] leading-none',
        dark
          ? 'border border-white/35 text-white'
          : 'bg-sk-blue-wash text-sk-body',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BlueSkillChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-sk-blue-tint px-2 py-1 font-mono text-[11px] font-medium leading-none text-sk-blue',
        className,
      )}
    >
      {children}
    </span>
  );
}
