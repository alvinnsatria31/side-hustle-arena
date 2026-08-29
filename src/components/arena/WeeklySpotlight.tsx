import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WinnerCard } from '@/components/ui/WinnerCard';
import { mockWinners } from '@/data/mock/winners';

export function WeeklySpotlight() {
  const [first, second, third] = mockWinners;
  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
            Weekly Spotlight
          </span>
          <h2 className="mt-2 text-[24px] sm:text-[30px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
            Pemenang minggu lalu
          </h2>
        </div>
        <Link
          href="/arena/showcase"
          className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
        >
          Lihat semua pemenang
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <WinnerCard winner={first} />
        </div>
        <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
          <WinnerCard winner={second} />
          <WinnerCard winner={third} />
        </div>
      </div>
    </div>
  );
}
