import { Skeleton, SkeletonCard, SkeletonText } from '@/components/primitives/Skeleton';

/** Career-report-shaped loading skeleton (design state 14a). */
export default function CareerReportLoading() {
  return (
    <div className="pt-5">
      <Skeleton className="mb-3 h-3 w-40" />
      <Skeleton className="mb-2 h-8 w-72" />
      <SkeletonText lines={2} className="mb-8 max-w-lg" />

      <div className="mb-8 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-5">
            <Skeleton className="mb-3 h-2.5 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SkeletonCard className="min-h-[280px]" />
        <div className="flex flex-col gap-4">
          <SkeletonCard className="min-h-[180px]" />
          <SkeletonCard className="min-h-[140px]" />
        </div>
      </div>
    </div>
  );
}
