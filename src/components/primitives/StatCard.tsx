import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: string;
  suffix?: string;
  small?: boolean;
  className?: string;
  dark?: boolean;
}

/** Glass stat widget — floating surfaces only (hero, arena stats). */
export function StatCard({ label, value, suffix, small, className, dark }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-sk-xl)] p-4 md:p-5',
        dark
          ? 'border border-white/15 bg-white/10 backdrop-blur-md'
          : 'glass-card',
        className,
      )}
    >
      <div
        className={cn(
          'mb-1 font-mono text-[9.5px] uppercase tracking-[0.1em]',
          dark ? 'text-white/65' : 'text-sk-muted',
        )}
      >
        {label}
      </div>
      {small ? (
        <div className={cn('pt-1 text-[16px] font-bold', dark ? 'text-white' : 'text-sk-navy')}>{value}</div>
      ) : (
        <div className={cn('text-[22px] font-extrabold tracking-[-0.02em] md:text-[26px]', dark ? 'text-white' : 'text-sk-navy')}>
          {value}
          {suffix && (
            <small className={cn('ml-1.5 text-[12px] font-semibold', dark ? 'text-white/70' : 'text-sk-muted')}>
              {suffix}
            </small>
          )}
        </div>
      )}
    </div>
  );
}
