'use client';

import Link from 'next/link';
import { Plus, Briefcase, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { PortfolioCard } from '@/components/ui/PortfolioCard';
import { EmptyState } from '@/components/states/EmptyState';
import { mockPortfolio } from '@/data/mock/portfolio';

export default function PortfolioListPage() {
  if (mockPortfolio.length === 0) {
    return (
      <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-12">
        <EmptyState
          icon={<Briefcase className="h-5 w-5" />}
          title="Belum ada project di portfolio"
          description="Setelah project dinilai, kamu bisa menjadikannya case study profesional di sini."
          cta={{ label: 'Selesaikan Weekly Project', href: '/arena/projects' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-8 lg:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
            Portfolio
          </span>
          <h1 className="mt-2 text-[28px] sm:text-[34px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
            Case study profesionalmu.
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--color-ink-tertiary)] max-w-xl">
            Hasilkan case study dari setiap project yang sudah kamu selesaikan.
          </p>
        </div>
        <Link href="/app/portfolio/p-1/edit">
          <Button variant="primary" iconLeft={<Plus className="h-4 w-4" />}>
            Tambah Case Study
          </Button>
        </Link>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockPortfolio.map((p) => (
          <PortfolioCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}
