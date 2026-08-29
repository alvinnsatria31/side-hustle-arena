'use client';

import Link from 'next/link';
import { ChevronRight, CheckCircle2, Lock } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { ScoreCard } from '@/components/ui/ScoreCard';
import { ScoreBreakdown } from '@/components/ui/ScoreBreakdown';
import { IssueCard } from '@/components/ui/IssueCard';
import { BeforeAfter } from '@/components/ui/BeforeAfter';
import { KeywordMatchCard } from '@/components/ui/KeywordMatch';
import { RecommendationCard } from '@/components/ui/RecommendationCard';
import { CheckCircle } from 'lucide-react';
import { mockCVAnalysis } from '@/data/mock/cv-result';

export default function CVResultPage() {
  const analysis = mockCVAnalysis;
  return (
    <div className="bg-[var(--color-surface-base)]">
      {/* Breadcrumb */}
      <div className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8 h-12 flex items-center gap-2 text-[12.5px] text-[var(--color-ink-tertiary)]">
          <Link href="/" className="hover:text-[var(--color-ink-primary)]">
            <BrandLogo size="sm" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/cv-scanner" className="hover:text-[var(--color-ink-primary)]">
            CV Scanner
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[var(--color-ink-primary)] font-semibold">Hasil Analisis</span>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-10 lg:py-14 anim-fade-up">
        {/* Top: Score + Breakdown */}
        <div className="grid gap-5 lg:grid-cols-2">
          <ScoreCard
            score={analysis.score}
            statusLabel={analysis.statusLabel}
            summary={analysis.summary}
            primaryCta={{ label: 'Lihat Rekomendasi Lengkap', href: '#rekomendasi' }}
            secondaryCta={{ label: 'Scan CV Lain', href: '/cv-scanner' }}
          />
          <ScoreBreakdown metrics={analysis.metrics} />
        </div>

        {/* Priority issues */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[22px] sm:text-[26px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
              3 hal yang paling perlu diperbaiki
            </h2>
            <span className="hidden sm:inline-block text-[12px] text-[var(--color-ink-tertiary)]">
              Berdasarkan analisis CV
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {analysis.priorityIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </section>

        {/* What works */}
        <section className="mt-10">
          <Card padding="lg">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[var(--radius-md)] bg-[var(--color-success-soft)] text-[var(--color-success)] flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-[18px] font-semibold text-[var(--color-ink-primary)]">Yang sudah kuat</h3>
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {analysis.strengths.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-3.5"
                >
                  <CheckCircle className="h-4 w-4 mt-0.5 text-[var(--color-success)] shrink-0" />
                  <div>
                    <p className="text-[13.5px] font-semibold text-[var(--color-ink-primary)]">{s.title}</p>
                    {s.description && (
                      <p className="text-[12.5px] text-[var(--color-ink-tertiary)] mt-0.5">{s.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Before / After */}
        <section className="mt-10">
          <BeforeAfter example={analysis.beforeAfter} />
        </section>

        {/* Keyword match */}
        {analysis.keywordMatch && (
          <section className="mt-10">
            <KeywordMatchCard data={analysis.keywordMatch} />
          </section>
        )}

        {/* Recommendations */}
        <section id="rekomendasi" className="mt-10">
          <h2 className="text-[22px] sm:text-[26px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
            Rekomendasi untuk kamu
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-ink-tertiary)]">
            Berdasarkan hasil analisis, ini langkah yang paling berdampak.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {analysis.recommendations.map((rec) => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        </section>

        {/* Save / Login prompt */}
        <section className="mt-12">
          <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-brand-200)] bg-gradient-to-br from-[var(--color-brand-50)] to-white p-7 sm:p-9">
            <div className="max-w-xl">
              <h2 className="text-[24px] sm:text-[28px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
                Simpan perkembangan karirmu.
              </h2>
              <p className="mt-2 text-[14px] text-[var(--color-ink-secondary)]">
                Buat akun gratis untuk akses fitur lengkap Sekolah Karir.
              </p>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  'Simpan hasil scan CV',
                  'Lihat riwayat analisis',
                  'Pantau perkembangan CV',
                  'Akses Weekly Project',
                  'Bangun Career Report',
                  'Hasilkan Portfolio',
                ].map((b) => (
                  <li key={b} className="flex items-center gap-2 text-[13.5px] text-[var(--color-ink-secondary)]">
                    <CheckCircle2 className="h-4 w-4 text-[var(--color-brand-500)] shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-2">
                <Link href="/register">
                  <Button variant="primary" size="lg">
                    Buat Akun Gratis
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" size="lg" iconLeft={<Lock className="h-4 w-4" />}>
                    Masuk
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden md:block absolute -right-12 -bottom-12 h-56 w-56 rounded-full bg-[var(--color-brand-100)] opacity-50 blur-2xl" aria-hidden />
          </div>
        </section>
      </div>
    </div>
  );
}
