import { Skeleton } from '@/components/primitives/Skeleton';

export default function ShowcaseLoading() {
  return (
    <div className="pt-2">
      <Skeleton className="mb-2 h-4 w-40" />
      <Skeleton className="mb-3 h-10 w-96" />
      <Skeleton className="mb-10 h-4 w-full max-w-lg" />
      <Skeleton className="mb-10 h-[280px] w-full rounded-[var(--radius-sk-2xl)]" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-6">
            <Skeleton className="mb-3 h-6 w-16 rounded-full" />
            <Skeleton className="mb-2 h-5 w-4/5" />
            <Skeleton className="mb-4 h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
