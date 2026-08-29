'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Award, Briefcase, BarChart3 } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { FolderKanban } from 'lucide-react';
import { mockWeeklyProjects } from '@/data/mock/projects';
import { useWeeklyProject } from '@/features/weekly-project/useWeeklyProject';
import { RubricBreakdown } from '@/components/ui/RubricBreakdown';
import { FeedbackCard } from '@/components/ui/FeedbackCard';
import { CareerMetric } from '@/components/ui/CareerMetric';
import { SkillChip } from '@/components/primitives/SkillChip';

const SCORE_LABELS: Record<string, string> = {
  good: 'GOOD',
  strong: 'STRONG WORK',
  fair: 'FAIR',
  poor: 'NEEDS WORK',
};

const SCORE_TONES: Record<string, { bg: string; text: string; border: string }> = {
  good: { bg: 'bg-[var(--color-success-soft)]', text: 'text-[var(--color-success)]', border: 'border-transparent' },
  strong: { bg: 'bg-[var(--color-brand-50)]', text: 'text-[var(--color-brand-700)]', border: 'border-[var(--color-brand-200)]' },
  fair: { bg: 'bg-[var(--color-warning-soft)]', text: 'text-[var(--color-warning)]', border: 'border-transparent' },
  poor: { bg: 'bg-[var(--color-danger-soft)]', text: 'text-[var(--color-danger)]', border: 'border-transparent' },
};

export default function ProjectResultPage() {
  const { selectedSlug, showResult } = useWeeklyProject();
  const project = selectedSlug ? mockWeeklyProjects.find((p) => p.slug === selectedSlug) : null;
  const evaluation = project?.evaluation;

  useEffect(() => {
    // Ensure we show result state if user comes directly
    if (project && !evaluation) {
      // No evaluation yet — just keep on page
    }
  }, [project, evaluation]);

  if (!project || !evaluation) {
    return (
      <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-10">
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title="Hasil belum tersedia"
          description="Hasil evaluasi keluar pada Sabtu pukul 12:00 WIB."
          cta={{ label: 'Kembali ke Beranda', href: '/app' }}
        />
      </div>
    );
  }

  const tone = SCORE_TONES[evaluation.statusTone] ?? SCORE_TONES.good;

  return (
    <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-8 lg:py-10">
      {/* Hero result */}
      <Card padding="xl" className="bg-gradient-to-br from-[var(--color-brand-50)] to-white border-[var(--color-brand-100)] overflow-hidden relative">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
              Hasil Evaluasi
            </span>
            <h1 className="mt-3 text-[28px] sm:text-[36px] font-bold text-[var(--color-ink-primary)] tracking-[-0.02em]">
              {project.title}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-[var(--color-ink-tertiary)]">
              {project.division} · Dinilai oleh evaluator
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-pill)] text-[12px] font-semibold ${tone.bg} ${tone.text}`}>
                <Award className="h-3.5 w-3.5" />
                {SCORE_LABELS[evaluation.statusTone] ?? evaluation.statusLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-pill)] bg-[var(--color-success-soft)] text-[12px] font-semibold text-[var(--color-success)]">
                <BarChart3 className="h-3.5 w-3.5" />
                +{project.rewardPoints} pts
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[64px] sm:text-[80px] leading-none font-bold text-[var(--color-ink-primary)] tracking-[-0.04em]">
              {evaluation.score}
            </p>
            <p className="mt-1 text-[14px] text-[var(--color-ink-tertiary)]">/ 100</p>
          </div>
        </div>
      </Card>

      {/* Metrics */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <CareerMetric
          label="Strategy"
          value={evaluation.rubric[0]?.score ?? 0}
          sublabel={evaluation.rubric[0]?.description}
        />
        <CareerMetric
          label="Execution"
          value={evaluation.rubric[2]?.score ?? 0}
          sublabel={evaluation.rubric[2]?.description}
        />
        <CareerMetric
          label="Communication"
          value={evaluation.rubric[3]?.score ?? 0}
          sublabel={evaluation.rubric[3]?.description}
        />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <RubricBreakdown rubric={evaluation.rubric} />
        <Card padding="lg">
          <h3 className="text-[17px] font-semibold text-[var(--color-ink-primary)]">Skills practiced</h3>
          <p className="mt-1 text-[13px] text-[var(--color-ink-tertiary)]">
            Skill ini akan diperbarui di Career Report.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.skills.map((s) => (
              <SkillChip key={s} label={s} />
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <FeedbackCard
          strengths={evaluation.strengths}
          improvements={evaluation.improvements}
          evaluatorNote={evaluation.evaluatorNote}
        />
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Link href="/app/report">
          <Button variant="secondary" iconLeft={<BarChart3 className="h-4 w-4" />}>
            Lihat Career Report
          </Button>
        </Link>
        <Link href={`/app/portfolio/p-1/edit`}>
          <Button variant="primary" iconRight={<ArrowRight className="h-4 w-4" />}>
            Tambahkan ke Portfolio
          </Button>
        </Link>
      </div>
    </div>
  );
}
