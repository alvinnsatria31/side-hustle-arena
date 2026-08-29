'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ArrowRight, Sparkles } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { ProjectCard } from '@/components/arena/ProjectCard';
import { ProjectFilterChips } from '@/components/arena/ProjectFilterChips';
import { mockWeeklyProjects, mockWeekLabel } from '@/data/mock/projects';
import { useWeeklyProject } from '@/features/weekly-project/useWeeklyProject';
import type { ProjectDivision } from '@/types/project';

const filterOptions: Array<{ value: 'Semua' | ProjectDivision; label: string }> = [
  { value: 'Semua', label: 'Semua' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Human Resources', label: 'HR' },
  { value: 'UI/UX', label: 'UI/UX' },
  { value: 'Data', label: 'Data' },
  { value: 'Business', label: 'Business' },
  { value: 'AI', label: 'AI' },
];

export default function ProjectsListPage() {
  const router = useRouter();
  const { selectedSlug, stage } = useWeeklyProject();
  const [filter, setFilter] = useState<'Semua' | ProjectDivision>('Semua');

  const filtered = filter === 'Semua' ? mockWeeklyProjects : mockWeeklyProjects.filter((p) => p.division === filter);
  const selected = selectedSlug ? mockWeeklyProjects.find((p) => p.slug === selectedSlug) : null;

  return (
    <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-8 lg:py-10">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-tertiary)]">
        <CalendarDays className="h-4 w-4" />
        {mockWeekLabel}
      </div>
      <h1 className="mt-2 text-[28px] sm:text-[34px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
        Weekly Project
      </h1>
      <p className="mt-1.5 text-[14px] text-[var(--color-ink-tertiary)] max-w-xl">
        Pilih 1 project minggu ini. Setelah dipilih, kamu tidak bisa ganti sampai minggu depan.
      </p>

      {selected && (
        <div className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
              Project Minggumu
            </h2>
            <span className="text-[12px] text-[var(--color-ink-tertiary)]">
              Stage: <span className="font-semibold text-[var(--color-ink-primary)]">{stage ?? 'selected'}</span>
            </span>
          </div>
          <Card padding="lg" className="bg-gradient-to-br from-[var(--color-brand-50)] to-white border-[var(--color-brand-100)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
                  {selected.division}
                </p>
                <h3 className="mt-1.5 text-[20px] font-semibold text-[var(--color-ink-primary)]">
                  {selected.title}
                </h3>
                <p className="mt-1 text-[13px] text-[var(--color-ink-tertiary)]">
                  {selected.effort} · +{selected.rewardPoints} pts
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push('/app/project')}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Lanjutkan Project
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">
            {selected ? 'Project lain minggu ini' : 'Pilih project'}
          </h2>
        </div>
        <div className="mt-4">
          <ProjectFilterChips options={filterOptions} value={filter} onChange={setFilter} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const isSelected = selectedSlug === p.slug;
            const isOther = !!selectedSlug && !isSelected;
            return (
              <div key={p.slug} className="relative">
                <ProjectCard
                  project={p}
                  selected={isSelected}
                  locked={isOther}
                />
                {isOther && (
                  <div className="absolute top-3 right-3 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-tertiary)] bg-white/80 px-2 py-1 rounded">
                    Browse only
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
