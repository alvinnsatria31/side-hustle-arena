'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Clock, Cloud, Check } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { FolderKanban } from 'lucide-react';
import { mockWeeklyProjects } from '@/data/mock/projects';
import { useProjectDraft } from '@/features/weekly-project/useProjectDraft';
import { useWeeklyProject } from '@/features/weekly-project/useWeeklyProject';
import { SubmissionArea } from '@/components/ui/SubmissionArea';
import { DeliverableChecklist } from '@/components/ui/DeliverableChecklist';
import { SkillChip } from '@/components/primitives/SkillChip';
import { cn } from '@/lib/cn';

export default function WorkspacePage() {
  const router = useRouter();
  const { hydrated, selectedSlug, markInProgress } = useWeeklyProject();
  const project = selectedSlug ? mockWeeklyProjects.find((p) => p.slug === selectedSlug) : null;
  const { draft, status, writeDraft, toggleDeliverable } = useProjectDraft(selectedSlug ?? 'default');
  const [reviewMounted, setReviewMounted] = useState(false);

  useEffect(() => {
    if (hydrated && selectedSlug && typeof window !== 'undefined') {
      // ensure stage moves to in_progress when entering workspace
      markInProgress();
    }
  }, [hydrated, selectedSlug, markInProgress]);

  if (!hydrated) return null;
  if (!project) {
    return (
      <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-10">
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title="Belum ada project aktif"
          description="Pilih 1 project minggu ini untuk mulai kerja."
          cta={{ label: 'Lihat Project', href: '/app/projects' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-8 lg:py-10">
      {/* Header */}
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-tertiary)]">
        <Link href="/app/project" className="hover:text-[var(--color-ink-primary)]">
          {project.title}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--color-ink-primary)] font-semibold">Workspace</span>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
            Workspace
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--color-ink-tertiary)]">
            {project.title} · {project.division}
          </p>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-pill)] text-[12px] font-semibold',
            status === 'saving' && 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
            status === 'saved' && 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
            (status === 'idle' || status === 'unsaved') && 'bg-[var(--color-surface-soft)] text-[var(--color-ink-tertiary)]',
          )}
        >
          <Cloud className="h-3.5 w-3.5" />
          {status === 'saving' && 'Saving...'}
          {status === 'saved' && 'Saved just now'}
          {(status === 'idle' || status === 'unsaved') && 'Auto-save aktif'}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Center column */}
        <div className="space-y-5 min-w-0">
          <Card padding="lg">
            <h2 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">Submission</h2>
            <p className="mt-1 text-[13px] text-[var(--color-ink-tertiary)]">
              Pilih cara kamu ingin mengumpulkan hasil kerja.
            </p>
            <div className="mt-5">
              <SubmissionArea
                text={draft?.text ?? ''}
                link={draft?.link ?? ''}
                notes={draft?.notes ?? ''}
                onChange={(patch) => writeDraft(patch)}
              />
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <Link href="/app/project">
              <Button variant="ghost">Kembali ke overview</Button>
            </Link>
            <Button
              variant="primary"
              onClick={() => router.push('/app/project/review')}
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              Review Submission
            </Button>
          </div>
        </div>

        {/* Right column: brief + checklist + deadline */}
        <div className="space-y-5">
          <Card padding="lg">
            <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Brief</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-ink-tertiary)] line-clamp-5">
              {project.case}
            </p>
            <Link
              href={`/arena/projects/${project.slug}`}
              className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
            >
              Lihat brief lengkap →
            </Link>
          </Card>

          <Card padding="lg">
            <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Deadline</h3>
            <p className="mt-2 text-[13.5px] font-semibold text-[var(--color-ink-primary)] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--color-brand-500)]" />
              {project.deadlineLabel}
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
              2 hari lagi
            </p>
          </Card>

          <Card padding="lg">
            <DeliverableChecklist
              items={project.deliverables.map((d) => ({
                id: d.id,
                title: d.title,
                description: d.description,
                done: !!draft?.deliverables[d.id],
              }))}
              onToggle={toggleDeliverable}
            />
          </Card>

          <Card padding="lg" className="bg-[var(--color-surface-soft)]">
            <h3 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">Skills</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.skills.map((s) => (
                <SkillChip key={s} label={s} size="sm" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
