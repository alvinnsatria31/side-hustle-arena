import { Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { WinnerCard } from '@/components/ui/WinnerCard';
import { mockWinners } from '@/data/mock/winners';
import Link from 'next/link';

export default function ShowcasePage() {
  const [first, second, third] = mockWinners;
  return (
    <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-12 lg:py-16">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
          <Trophy className="h-3.5 w-3.5" />
          Showcase
        </span>
        <h1 className="mt-4 text-[40px] sm:text-[52px] font-bold text-[var(--color-ink-primary)] tracking-[-0.02em] leading-[1.05]">
          Pemenang minggu lalu.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-secondary)] max-w-xl">
          Karya yang dinilai paling kuat oleh evaluator Sekolah Karir. Bukan karena popularitas, tapi karena
          kualitas strategi, eksekusi, dan dampaknya.
        </p>
      </div>

      {/* Winner #1 — featured */}
      <div className="mt-10">
        <WinnerCard winner={first} className="max-w-2xl" />
      </div>

      {/* Runners up */}
      <div className="mt-10">
        <h2 className="text-[18px] font-semibold text-[var(--color-ink-primary)]">Runner Up</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <WinnerCard winner={second} />
          <WinnerCard winner={third} />
        </div>
      </div>

      {/* CTA */}
      <div className="mt-14 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-[18px] font-semibold text-[var(--color-ink-primary)]">Mau jadi pemenang berikutnya?</h3>
          <p className="mt-1 text-[13.5px] text-[var(--color-ink-tertiary)]">
            Pilih project minggu ini dan kerjakan dengan serius.
          </p>
        </div>
        <Link href="/arena">
          <Button variant="primary" iconRight={<ArrowRight className="h-4 w-4" />}>
            Lihat Project Minggu Ini
          </Button>
        </Link>
      </div>
    </div>
  );
}
