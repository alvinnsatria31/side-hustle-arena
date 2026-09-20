import { Skeleton } from '@/components/primitives/Skeleton';

/**
 * The dashboard's shape while its data is in flight.
 *
 * The old screen hid everything behind a centred spinner, so the page jumped
 * from 120px tall to full height the moment `/api/arena/me` answered — and did
 * it again on every window focus. Holding the real geometry keeps the layout
 * still and tells the participant what is coming.
 */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Memuat ringkasan" className="space-y-4">
      <Skeleton className="h-[280px] rounded-[var(--radius-sk-3xl)] sm:h-[240px]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[104px] rounded-[var(--radius-sk-xl)]" />
        ))}
      </div>
      <div className="grid gap-4 pt-6 md:grid-cols-2">
        <Skeleton className="h-[260px] rounded-[var(--radius-sk-2xl)]" />
        <Skeleton className="h-[260px] rounded-[var(--radius-sk-2xl)]" />
      </div>
    </div>
  );
}
