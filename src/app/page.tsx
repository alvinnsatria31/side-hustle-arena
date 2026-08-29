import Link from 'next/link';
import { ArrowRight, Sparkles, Briefcase, FileSearch, Award } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { BrandMark } from '@/components/brand/BrandMark';

export default function HomePage() {
  return (
    <div className="bg-[var(--color-surface-base)]">
      {/* Hero */}
      <section className="mx-auto max-w-[1280px] px-5 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 h-8 px-3 rounded-[var(--radius-pill)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] text-[12px] font-semibold tracking-wide">
            <BrandMark size={14} />
            SEKOLAH KARIR
          </div>
          <h1 className="mt-5 text-[40px] sm:text-[52px] lg:text-[60px] leading-[1.05] font-bold tracking-[-0.03em] text-[var(--color-ink-primary)]">
            Cek CV kamu, kerjakan project nyata, bangun laporan karirmu.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-[var(--color-ink-secondary)] max-w-2xl">
            Platform karier yang membantu mahasiswa dan profesional awal menghubungkan teori dengan pengalaman
            industri nyata — lewat CV Scanner gratis, weekly project, dan Career Report yang terukur.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/cv-scanner">
              <Button variant="primary" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                Scan CV Gratis
              </Button>
            </Link>
            <Link href="/arena">
              <Button variant="secondary" size="lg">
                Lihat Side Hustle Arena
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="mx-auto max-w-[1280px] px-5 lg:px-8 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          <Card padding="lg" className="h-full">
            <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
              <FileSearch className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-[18px] font-semibold text-[var(--color-ink-primary)]">CV / ATS Scanner</h3>
            <p className="mt-2 text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
              Analisis struktur, keterbacaan, keyword, dan kesiapan recruiter dalam hitungan detik. Gratis, tanpa login.
            </p>
          </Card>
          <Card padding="lg" className="h-full">
            <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
              <Briefcase className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-[18px] font-semibold text-[var(--color-ink-primary)]">Side Hustle Arena</h3>
            <p className="mt-2 text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
              Setiap minggu, pilih 1 project dunia nyata. Submit Jumat, nilai keluar Sabtu, lalu jadi portfolio.
            </p>
          </Card>
          <Card padding="lg" className="h-full">
            <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-[18px] font-semibold text-[var(--color-ink-primary)]">Career Report</h3>
            <p className="mt-2 text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
              Lihat pertumbuhan skill, rata-rata nilai, dan histori project-mu. Bukti karirmu, terukur.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
