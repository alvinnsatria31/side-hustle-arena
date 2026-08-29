'use client';

import Link from 'next/link';
import { ArrowRight, Trophy, CalendarDays } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { ProjectCard } from '@/components/arena/ProjectCard';
import { HowItWorks } from '@/components/arena/HowItWorks';
import { ProjectFilterChips } from '@/components/arena/ProjectFilterChips';
import { WeeklySpotlight } from '@/components/arena/WeeklySpotlight';
import { mockWeeklyProjects, mockWeekLabel } from '@/data/mock/projects';
import { useState } from 'react';
import type { ProjectDivision } from '@/types/project';
import { useDemoAuth } from '@/features/auth/useDemoAuth';
import { useWeeklyProject } from '@/features/weekly-project/useWeeklyProject';
import { useRouter } from 'next/navigation';

const filterOptions: Array<{ value: 'Semua' | ProjectDivision; label: string }> = [
  { value: 'Semua', label: 'Semua' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Human Resources', label: 'HR' },
  { value: 'UI/UX', label: 'UI/UX' },
  { value: 'Data', label: 'Data' },
  { value: 'Business', label: 'Business' },
  { value: 'AI', label: 'AI' },
];

export default function ArenaLanding() {
  const [filter, setFilter] = useState<'Semua' | ProjectDivision>('Semua');
  const { isAuthed } = useDemoAuth();
  const { selectedSlug } = useWeeklyProject();
  const router = useRouter();

  const filtered = filter === 'Semua' ? mockWeeklyProjects : mockWeeklyProjects.filter((p) => p.division === filter);

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-[1280px] px-5 lg:px-8 pt-14 pb-12 lg:pt-20 lg:pb-16">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] items-center">
          <div>
            <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
              Side Hustle Arena
            </span>
            <h1 className="mt-4 text-[40px] sm:text-[52px] lg:text-[60px] leading-[1.05] font-bold tracking-[-0.03em] text-[var(--color-ink-primary)]">
              Kerjakan project dunia nyata setiap minggu.
            </h1>
            <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed text-[var(--color-ink-secondary)] max-w-xl">
              Pilih 1 project, submit sebelum Jumat, nilai keluar Sabtu, lalu ubah hasilmu menjadi portfolio.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#projects">
                <Button variant="primary" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                  Lihat Project Minggu Ini
                </Button>
              </a>
              <Link href="/arena/showcase">
                <Button variant="secondary" size="lg" iconLeft={<Trophy className="h-4 w-4" />}>
                  Lihat Pemenang Minggu Lalu
                </Button>
              </Link>
            </div>
          </div>

          {/* Visual preview */}
          <div className="relative">
            <div className="grid gap-3">
              <Card padding="md" className="ml-auto w-[88%] transform rotate-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
                    Marketing
                  </span>
                </div>
                <h3 className="mt-2 text-[16px] font-semibold text-[var(--color-ink-primary)]">
                  Build a Campaign Strategy
                </h3>
                <div className="mt-3 flex items-center gap-3 text-[12px] text-[var(--color-ink-tertiary)]">
                  <span>4–6 jam</span>
                  <span>·</span>
                  <span>+450 pts</span>
                </div>
              </Card>

              <Card padding="md" className="w-[80%] transform -rotate-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
                    Score
                  </span>
                  <span className="text-[12px] text-[var(--color-ink-tertiary)]">Result Sabtu</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[36px] font-bold text-[var(--color-ink-primary)] tracking-[-0.02em]">84</span>
                  <span className="text-[14px] text-[var(--color-ink-tertiary)]">/ 100</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--color-brand-50)] overflow-hidden">
                  <div className="h-full w-[84%] bg-[var(--color-brand-500)]" />
                </div>
              </Card>

              <Card padding="md" className="ml-auto w-[78%] transform rotate-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
                    Portfolio
                  </span>
                </div>
                <h3 className="mt-2 text-[15px] font-semibold text-[var(--color-ink-primary)]">
                  Social Media Launch Strategy
                </h3>
                <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
                  Campaign strategy untuk meningkatkan sign-ups internship 30%.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-[var(--color-border)]">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-14 lg:py-20">
          <div className="max-w-2xl">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
              How it works
            </span>
            <h2 className="mt-3 text-[28px] sm:text-[34px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
              Loop yang sama setiap minggunya.
            </h2>
            <p className="mt-3 text-[15px] text-[var(--color-ink-secondary)]">
              Konsisten, terstruktur, dan terukur — supaya karirmu benar-benar terbangun.
            </p>
          </div>
          <div className="mt-9">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* Weekly projects */}
      <section id="projects" className="mx-auto max-w-[1280px] px-5 lg:px-8 py-14 lg:py-20">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
              This Week
            </span>
            <h2 className="mt-2 text-[28px] sm:text-[34px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
              Project Minggu Ini
            </h2>
            <div className="mt-2 flex items-center gap-2 text-[13.5px] text-[var(--color-ink-tertiary)]">
              <CalendarDays className="h-4 w-4" />
              {mockWeekLabel}
            </div>
          </div>
          <Link href="/arena/projects" className="text-[13.5px] font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]">
            Lihat semua project →
          </Link>
        </div>

        {/* Rules card */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Pilih 1 project', detail: 'Hanya satu project per minggu.' },
            { label: 'Deadline Jumat 23:59', detail: 'Submit lewat dari itu tidak diterima.' },
            { label: 'Result Sabtu', detail: 'Nilai keluar mulai pukul 12:00 WIB.' },
          ].map((r) => (
            <div
              key={r.label}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4"
            >
              <p className="text-[13px] font-semibold text-[var(--color-ink-primary)]">{r.label}</p>
              <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">{r.detail}</p>
            </div>
          ))}
        </div>

        {/* Filter + grid */}
        <div className="mt-7 flex items-center justify-between gap-3">
          <ProjectFilterChips options={filterOptions} value={filter} onChange={setFilter} className="flex-1" />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard
              key={p.slug}
              project={p}
              selected={selectedSlug === p.slug}
              locked={!!selectedSlug && selectedSlug !== p.slug && !isAuthed}
            />
          ))}
        </div>
      </section>

      {/* Spotlight */}
      <section className="bg-white border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-14 lg:py-20">
          <WeeklySpotlight />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1280px] px-5 lg:px-8 py-14 lg:py-20">
        <div className="rounded-[var(--radius-xl)] bg-[var(--color-ink-primary)] p-7 sm:p-10 grid gap-6 md:grid-cols-[1.2fr_1fr] items-center">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-300)]">
              Mulai dari minggu ini
            </span>
            <h2 className="mt-3 text-[26px] sm:text-[32px] font-bold text-white tracking-[-0.01em]">
              Pilih project pertamamu.
            </h2>
            <p className="mt-3 text-[14.5px] text-white/70 max-w-md">
              Submit, dapatkan feedback dari evaluator, dan lihat skor pertamamu masuk ke Career Report.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <a href="#projects">
              <Button variant="primary" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                Lihat Project
              </Button>
            </a>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => router.push(isAuthed ? '/app' : '/register')}
            >
              {isAuthed ? 'Buka Dashboard' : 'Buat Akun'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
