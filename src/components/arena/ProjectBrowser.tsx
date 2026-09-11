'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { FilterChip } from '@/components/primitives/FilterChip';
import { SearchInput } from '@/components/primitives/SearchInput';
import { EmptyState } from '@/components/states/EmptyState';
import { ProjectCard } from '@/components/arena/ProjectCard';
import { useSavedProjects } from '@/lib/saved-projects';
import type { ArenaProject } from '@/types/project';
import { cn } from '@/lib/cn';

const FALLBACK_GROUPS = ['Semua', 'Data', 'Development', 'Design', 'Marketing', 'HR', 'Business'] as const;
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];
const TIME_BUCKETS = [
  { label: '≤ 4 jam', max: 4 },
  { label: '4–8 jam', min: 4, max: 8 },
  { label: '8+ jam', min: 8 },
];

function timeToHours(estimate: string): number {
  const nums = estimate.match(/\d+/g)?.map(Number) ?? [0];
  return nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
}

interface ProjectBrowserProps {
  hrefPrefix?: string;
  showRecommended?: boolean;
  /** Explicit live catalog; a missing database catalog must never invent projects. */
  projects: ArenaProject[];
  /** Live division names (without 'Semua'). Defaults to the mock groups. */
  groups?: string[];
  recommendedSlug?: string;
  /** Open on the saved projects — the page passes `?view=saved`, linked from the dashboard. */
  initialSavedOnly?: boolean;
}

/** Working search + filters over the project catalog (no reload, animated). */
export function ProjectBrowser({
  hrefPrefix = '/arena/projects',
  showRecommended = true,
  projects,
  groups,
  recommendedSlug,
  initialSavedOnly = false,
}: ProjectBrowserProps) {
  const GROUPS = useMemo(() => ['Semua', ...(groups ?? [...FALLBACK_GROUPS].slice(1))], [groups]);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('Semua');
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [timeBucket, setTimeBucket] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<'difficulty' | 'skill' | 'time' | null>(null);
  const { saved, prune } = useSavedProjects();
  const [savedOnly, setSavedOnly] = useState(initialSavedOnly);

  const catalogSlugs = useMemo(() => new Set(projects.map((p) => p.slug)), [projects]);
  const savedHere = useMemo(() => saved.filter((slug) => catalogSlugs.has(slug)), [saved, catalogSlugs]);
  // The catalog is weekly: a project saved last week may no longer be open.
  const savedElsewhere = saved.length - savedHere.length;

  const allSkills = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach((p) => p.skills.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([s]) => s);
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (savedOnly && !saved.includes(p.slug)) return false;
      if (group !== 'Semua' && p.group !== group) return false;
      if (difficulty && p.difficulty !== difficulty) return false;
      if (skill && !p.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return false;
      if (timeBucket) {
        const bucket = TIME_BUCKETS.find((b) => b.label === timeBucket);
        if (!bucket) return false;
        const hours = timeToHours(p.estimatedTime);
        if (bucket.max !== undefined && hours > bucket.max) return false;
        if (bucket.min !== undefined && hours < bucket.min) return false;
      }
      if (q && ![p.title, p.category, p.shortDescription, ...p.skills].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, group, difficulty, skill, timeBucket, projects, savedOnly, saved]);

  // Saved view: most recently saved first. Otherwise the recommended card
  // floats to the top when it survives filtering.
  const ordered = useMemo(() => {
    if (savedOnly) {
      const position = new Map(saved.map((slug, index) => [slug, index]));
      return [...filtered].sort((a, b) => (position.get(b.slug) ?? -1) - (position.get(a.slug) ?? -1));
    }
    if (!showRecommended) return filtered;
    const idx = filtered.findIndex((p) => p.slug === recommendedSlug);
    if (idx <= 0) return filtered;
    const clone = [...filtered];
    const [rec] = clone.splice(idx, 1);
    return [rec, ...clone];
  }, [filtered, savedOnly, saved, showRecommended, recommendedSlug]);

  const hasActiveFilters = savedOnly || group !== 'Semua' || difficulty !== null || skill !== null || timeBucket !== null || query !== '';

  const resetAll = () => {
    setQuery('');
    setGroup('Semua');
    setDifficulty(null);
    setSkill(null);
    setTimeBucket(null);
    setSavedOnly(false);
  };

  const panelButton = (key: 'difficulty' | 'skill' | 'time', label: string, active: boolean) => (
    <button
      type="button"
      aria-expanded={openPanel === key}
      onClick={() => setOpenPanel(openPanel === key ? null : key)}
      className={cn(
        'inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sk-md)] border px-4 text-[13.5px] font-semibold transition-all duration-200 sm:flex-none',
        active
          ? 'border-sk-blue bg-sk-blue-tint text-sk-blue'
          : 'border-sk-navy/12 bg-transparent text-sk-navy hover:bg-white',
      )}
    >
      <SlidersHorizontal size={14} aria-hidden />
      {label}
      {active && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sk-blue" />}
    </button>
  );

  return (
    <div>
      {/* Search + filter buttons */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Cari project atau skill (contoh: SQL, dashboard, landing page)"
          label="Cari project"
        />
        <div className="flex gap-2.5">
          {panelButton('difficulty', 'Difficulty', Boolean(difficulty))}
          {panelButton('skill', 'Skill', Boolean(skill))}
          {panelButton('time', 'Waktu', Boolean(timeBucket))}
        </div>
      </div>

      {/* Filter panels */}
      <AnimatePresence initial={false}>
        {openPanel && (
          <motion.div
            key={openPanel}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mb-4 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-4">
              {openPanel === 'difficulty' && (
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map((d) => (
                    <FilterChip key={d} label={d} active={difficulty === d} onClick={() => setDifficulty(difficulty === d ? null : d)} />
                  ))}
                </div>
              )}
              {openPanel === 'skill' && (
                <div className="flex flex-wrap gap-2">
                  {allSkills.map((s) => (
                    <FilterChip key={s} label={s} active={skill === s} onClick={() => setSkill(skill === s ? null : s)} />
                  ))}
                </div>
              )}
              {openPanel === 'time' && (
                <div className="flex flex-wrap gap-2">
                  {TIME_BUCKETS.map((b) => (
                    <FilterChip
                      key={b.label}
                      label={b.label}
                      active={timeBucket === b.label}
                      onClick={() => setTimeBucket(timeBucket === b.label ? null : b.label)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved + group chips */}
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
        <FilterChip label="Tersimpan" active={savedOnly} onClick={() => setSavedOnly((value) => !value)} count={savedHere.length} />
        <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-sk-border" />
        {GROUPS.map((g) => (
          <FilterChip
            key={g}
            label={g}
            active={group === g}
            onClick={() => setGroup(g)}
            count={g === 'Semua' ? projects.length : projects.filter((p) => p.group === g).length}
          />
        ))}
      </div>

      {savedOnly && savedElsewhere > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-border bg-white px-4 py-3 text-[12.5px] text-sk-muted">
          <span>{savedElsewhere} project tersimpan sudah tidak dibuka di katalog ini.</span>
          <Button variant="text" size="sm" onClick={() => prune(catalogSlugs)}>Hapus dari simpanan</Button>
        </div>
      )}

      {/* Results */}
      <div className="mb-4 flex items-center justify-between" aria-live="polite">
        <p className="font-mono text-[11.5px] tracking-[0.05em] text-sk-muted">
          {filtered.length} PROJECT {savedOnly ? 'TERSIMPAN' : 'DITEMUKAN'}
        </p>
        {hasActiveFilters && (
          <Button variant="text" size="sm" iconLeft={<X size={13} aria-hidden />} onClick={resetAll}>
            Reset filter
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        savedOnly && savedHere.length === 0 ? (
          <EmptyState
            title="Belum ada project tersimpan."
            description="Buka detail project lalu tekan “Simpan untuk nanti”. Project yang kamu simpan muncul di sini — tersimpan di browser ini, belum ikut ke perangkat lain."
            primaryAction={{ label: 'Lihat semua project', onClick: () => setSavedOnly(false) }}
          />
        ) : (
          <EmptyState
            title="Tidak ada project yang cocok."
            description="Coba longgarkan filter atau cari dengan kata kunci lain — project baru datang setiap Senin."
            primaryAction={{ label: 'Reset Semua Filter', onClick: resetAll }}
          />
        )
      ) : (
        <motion.div layout className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {ordered.map((project) => (
              <ProjectCard
                key={project.slug}
                project={project}
                hrefPrefix={hrefPrefix}
                recommended={!savedOnly && showRecommended && project.slug === recommendedSlug}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
