import { Skeleton } from '@/components/primitives/Skeleton';

export default function ArenaProjectsLoading() {
  return (
    <div className="pt-2">
      <Skeleton className="mb-2 h-4 w-48" />
      <Skeleton className="mb-6 h-9 w-72" />
      <Skeleton className="mb-4 h-12 w-full" />
      <Skeleton className="mb-8 h-9 w-full max-w-md" />
      <div className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-5">
            <Skeleton className="mb-3 h-2.5 w-20" />
            <Skeleton className="mb-2 h-5 w-4/5" />
            <Skeleton className="mb-4 h-3 w-full" />
            <div className="mb-3 flex gap-1.5">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
