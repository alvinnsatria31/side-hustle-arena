'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Clock, Zap, Check, ChevronRight } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { Badge } from '@/components/primitives/Badge';
import { EmptyState } from '@/components/states/EmptyState';
import { mockWeeklyProjects } from '@/data/mock/projects';
import { useWeeklyProject } from '@/features/weekly-project/useWeeklyProject';
import { FolderKanban } from 'lucide-react';

const stages = [
  { key: 'brief', label: 'Brief' },
  { key: 'work', label: 'Work' },
  { key: 'review', label: 'Review' },
  { key: 'submit', label: 'Submit' },
];

export default function ActiveProjectPage() {
  const router = useRouter();
  const { hydrated, selectedSlug, stage, markInProgress, showResult } = useWeeklyProject();

  // Default to first project if none selected
  useEffect(() => {
    if (hydrated && !selectedSlug) {
      // No project selected — show empty state
    }
  }, [hydrated, selectedSlug]);

  if (!hydrated) {
    return null;
  }

  const project = selectedSlug
    ? mockWeeklyProjects.find((p) => p.slug === selectedSlug)
    : null;

  if (!project) {
    return (
      <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-10">
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title="Belum ada project yang dipilih"
          description="Pilih 1 project minggu ini dan kerjakan sampai Jumat."
          cta={{ label: 'Lihat Project', href: '/arena/projects' }}
        />
      </div>
    );
  }

  // Determine current stage index
  let stageIndex = 1; // default to 'Work'
  if (stage === 'submitted') stageIndex = 3;
  else if (stage === 'result') stageIndex = 3;
  else if (stage === 'in_progress') stageIndex = 1;
  else stageIndex = 1;

  return (
    <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-8 lg:py-10">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-tertiary)]">
        <Link href="/app/projects" className="hover:text-[var(--color-ink-primary)]">
          Weekly Project
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--color-ink-primary)] font-semibold">{project.division}</span>
      </div>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
            {project.title}
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--color-ink-tertiary)]">
            {project.role}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="brand" size="md">{project.division}</Badge>
          <Badge variant="outline" size="md">{project.difficulty}</Badge>
          <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
            <Clock className="h-3.5 w-3.5" />
            {project.effort}
          </span>
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-brand-600)]">
            <Zap className="h-3.5 w-3.5" />
            +{project.rewardPoints} pts
          </span>
        </div>
      </div>

      {/* Stage tracker */}
      <div className="mt-7">
        <Card padding="lg">
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {stages.map((s, i) => {
              const done = i < stageIndex;
              const current = i === stageIndex;
              return (
                <div key={s.key} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        'h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold ' +
                        (done
                          ? 'bg-[var(--color-success)] text-white'
                          : current
                            ? 'bg-[var(--color-brand-500)] text-white anim-pulse-ring'
                            : 'bg-[var(--color-surface-soft)] text-[var(--color-ink-tertiary)]')
                      }
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span
                      className={
                        'text-[13px] font-semibold ' +
                        (current ? 'text-[var(--color-ink-primary)]' : 'text-[var(--color-ink-tertiary)]')
                      }
                    >
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-3 h-1 rounded-full bg-[var(--color-surface-soft)] overflow-hidden">
                    <div
                      className={
                        'h-full transition-all duration-500 ' +
                        (done ? 'w-full bg-[var(--color-success)]' : current ? 'w-1/2 bg-[var(--color-brand-500)]' : 'w-0')
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Project meta + CTA */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card padding="lg">
          <h2 className="text-[18px] font-semibold text-[var(--color-ink-primary)]">The Case</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
            {project.case}
          </p>

          <h3 className="mt-6 text-[14px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
            Objective
          </h3>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
            {project.objective}
          </p>

          <h3 className="mt-6 text-[14px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
            Deliverables
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {project.deliverables.map((d) => (
              <li key={d.id} className="flex items-start gap-2.5 text-[14px] text-[var(--color-ink-secondary)]">
                <Check className="h-4 w-4 mt-0.5 text-[var(--color-brand-500)] shrink-0" />
                {d.title}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card padding="lg">
            <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Deadline</h3>
            <p className="mt-2 text-[14px] font-semibold text-[var(--color-ink-primary)]">
              {project.deadlineLabel}
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
              Hasil evaluasi keluar pada hari Sabtu.
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[12px] text-[var(--color-ink-tertiary)] mb-1.5">
                <span>Progress</span>
                <span className="font-semibold text-[var(--color-ink-primary)]">70%</span>
              </div>
              <ProgressBar value={70} color="brand" size="md" />
            </div>
          </Card>

          <Card padding="lg" className="bg-[var(--color-brand-50)] border-[var(--color-brand-100)]">
            {stage === 'submitted' ? (
              <>
                <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Submission terkirim</h3>
                <p className="mt-2 text-[13px] text-[var(--color-ink-secondary)]">
                  Hasil evaluasi keluar Sabtu pukul 12:00 WIB.
                </p>
                <Button
                  variant="primary"
                  className="mt-4"
                  fullWidth
                  onClick={() => {
                    showResult();
                    router.push('/app/project/result');
                  }}
                >
                  Lihat Hasil
                </Button>
              </>
            ) : stage === 'result' ? (
              <>
                <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Hasil evaluasi tersedia</h3>
                <p className="mt-2 text-[13px] text-[var(--color-ink-secondary)]">
                  Cek nilai dan feedback dari evaluator.
                </p>
                <Link href="/app/project/result">
                  <Button variant="primary" className="mt-4" fullWidth iconRight={<ArrowRight className="h-4 w-4" />}>
                    Lihat Hasil
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Lanjutkan kerja</h3>
                <p className="mt-2 text-[13px] text-[var(--color-ink-secondary)]">
                  Simpan draft kapan saja, lalu submit sebelum Jumat 23:59.
                </p>
                <Link href="/app/project/workspace">
                  <Button
                    variant="primary"
                    className="mt-4"
                    fullWidth
                    iconRight={<ArrowRight className="h-4 w-4" />}
                    onClick={() => {
                      if (stage === 'selected') markInProgress();
                    }}
                  >
                    Lanjutkan Project
                  </Button>
                </Link>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
