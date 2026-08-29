'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { ProjectCard } from '@/components/arena/ProjectCard';
import { ProjectFilterChips } from '@/components/arena/ProjectFilterChips';
import { mockWeeklyProjects, mockWeekLabel } from '@/data/mock/projects';
import { useDemoAuth } from '@/features/auth/useDemoAuth';
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

export default function ArenaBrowsePage() {
  const [filter, setFilter] = useState<'Semua' | ProjectDivision>('Semua');
  const { isAuthed } = useDemoAuth();
  const { selectedSlug } = useWeeklyProject();
  const filtered = filter === 'Semua' ? mockWeeklyProjects : mockWeeklyProjects.filter((p) => p.division === filter);

  return (
    <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-12 lg:py-16">
      <div className="max-w-2xl">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
          This Week
        </span>
        <h1 className="mt-3 text-[36px] sm:text-[44px] font-bold text-[var(--color-ink-primary)] tracking-[-0.02em]">
          Browse project minggu ini
        </h1>
        <div className="mt-3 flex items-center gap-2 text-[13.5px] text-[var(--color-ink-tertiary)]">
          <CalendarDays className="h-4 w-4" />
          {mockWeekLabel}
        </div>
      </div>

      <div className="mt-8">
        <ProjectFilterChips options={filterOptions} value={filter} onChange={setFilter} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <ProjectCard
            key={p.slug}
            project={p}
            selected={selectedSlug === p.slug}
            locked={!!selectedSlug && selectedSlug !== p.slug}
          />
        ))}
      </div>
    </div>
  );
}
