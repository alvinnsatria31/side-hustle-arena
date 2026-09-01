import { cn } from '@/lib/cn';

/** Skeleton line that mirrors final geometry. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3.5', i === lines - 1 ? 'w-3/5' : i % 3 === 1 ? 'w-11/12' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-6', className)}>
      <Skeleton className="mb-4 h-3 w-24" />
      <Skeleton className="mb-2 h-7 w-3/4" />
      <SkeletonText lines={2} />
    </div>
  );
}
