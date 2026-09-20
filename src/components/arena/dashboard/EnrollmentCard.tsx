'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, Medal, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { ProjectMiniVisual, motifForDivision } from '@/components/landing/ProjectMiniVisual';
import {
  dashboardFocus,
  enrollmentStatus,
  STEP_ORDER,
  type EnrollmentTone,
} from '@/lib/dashboard-view';
import type { ParticipantEnrollment } from '@/lib/participant-client';
import { cn } from '@/lib/cn';

const toneStyles: Record<EnrollmentTone, string> = {
  result: 'bg-sk-success-tint text-sk-success',
  waiting: 'bg-sk-warning-tint text-sk-warning-ink',
  active: 'bg-sk-blue-tint text-sk-blue',
  sealed: 'bg-sk-track text-sk-muted',
  voided: 'bg-sk-error-tint text-sk-error',
};

/** The three result figures, shown only once a week is finalised. */
function ResultRow({ ranking }: { ranking: NonNullable<ParticipantEnrollment['ranking']> }) {
  const cells = [
    { label: 'Peringkat', value: `#${ranking.rank}` },
    { label: 'Skor', value: `${ranking.finalScore}` },
    { label: 'Poin', value: `+${ranking.pointsAwarded}` },
  ];
  return (
    <dl className="mt-4 grid grid-cols-3 divide-x divide-sk-border overflow-hidden rounded-[var(--radius-sk-md)] border border-sk-border bg-sk-blue-wash">
      {cells.map((cell) => (
        <div key={cell.label} className="px-3 py-2.5 text-center">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-sk-muted">
            {cell.label}
          </dt>
          <dd className="mt-1 font-mono text-[16px] font-bold tracking-[-0.03em] text-sk-navy">
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One enrollment, on the dashboard and on Proyekku.
 *
 * The previous card was a stack of sentences: the same typographic weight for
 * the week code, the deadline and the result, so nothing was findable at a
 * glance and a finished sprint looked identical to one still running. Three
 * things now separate them — the division motif, the status pill, and a body
 * that switches between a progress track (running) and the score row (done).
 */
export function EnrollmentCard({
  enrollment,
  compact,
}: {
  enrollment: ParticipantEnrollment;
  compact?: boolean;
}) {
  const slug = encodeURIComponent(enrollment.project.slug);
  const status = enrollmentStatus(enrollment);
  const focus = dashboardFocus(enrollment);
  const submitted = Boolean(enrollment.submission?.latestVersionId);
  const running = status.tone === 'active';
  const stepIndex = focus.step ? STEP_ORDER.indexOf(focus.step as (typeof STEP_ORDER)[number]) : -1;
  const deadline = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(enrollment.week.submissionDeadlineAt));

  return (
    <article
      className={cn(
        'card-rise group flex flex-col overflow-hidden rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white',
        status.tone === 'voided' && 'opacity-75',
      )}
    >
      <div className="flex items-stretch gap-4 p-4 pb-0 sm:p-5 sm:pb-0">
        {!compact && (
          <div
            aria-hidden
            className="hidden h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[var(--radius-sk-md)] border border-sk-border sm:block"
          >
            <ProjectMiniVisual motif={motifForDivision('', enrollment.project.division)} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-sk-faint">
              {enrollment.week.weekCode} · {enrollment.project.division}
            </span>
            <span
              className={cn(
                'ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold leading-none',
                toneStyles[status.tone],
              )}
            >
              {status.tone === 'result' && <Medal size={11} aria-hidden />}
              {status.label}
            </span>
          </div>
          <h3 className="mt-2 text-[17px] font-bold leading-snug tracking-[-0.02em] text-sk-navy">
            <Link
              href={`/app/arena/projects/${slug}`}
              className="transition-colors hover:text-sk-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
            >
              {enrollment.project.title}
            </Link>
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
        {enrollment.ranking ? (
          <ResultRow ranking={enrollment.ranking} />
        ) : running && stepIndex >= 0 ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-[11.5px]">
              <span className="font-semibold text-sk-body">{focus.stage}</span>
              <span className="font-mono text-[10.5px] text-sk-muted">
                Tahap {stepIndex + 1}/{STEP_ORDER.length}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-sk-track"
              role="progressbar"
              aria-valuenow={focus.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progres ${enrollment.project.title}`}
            >
              <span
                className="block h-full rounded-full bg-gradient-to-r from-sk-blue to-sk-blue-400 transition-[width] duration-700 ease-out"
                style={{ width: `${focus.progress}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-sk-md)] bg-sk-bg px-3 py-2.5 text-[12px] leading-relaxed text-sk-muted">
            <Sparkles size={13} className="mt-0.5 shrink-0" aria-hidden />
            {status.tone === 'waiting'
              ? 'Kiriman sudah masuk. Hasil terbit saat sprint difinalisasi.'
              : status.tone === 'sealed'
                ? 'Sprint ini tidak masuk perhitungan peringkat.'
                : 'Pendaftaran project ini dibatalkan.'}
          </p>
        )}

        <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-sk-faint">
          <CalendarClock size={13} className="shrink-0" aria-hidden />
          Tenggat {deadline} WIB
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sk-border pt-4">
          {!enrollment.sealed ? (
            <ButtonLink
              size="sm"
              href={`/app/arena/result/${slug}`}
              iconRight={<ArrowRight size={14} aria-hidden />}
            >
              Lihat hasil
            </ButtonLink>
          ) : submitted ? (
            <ButtonLink
              size="sm"
              href={`/app/arena/submission/${slug}`}
              iconRight={<ArrowRight size={14} aria-hidden />}
            >
              Lihat kiriman
            </ButtonLink>
          ) : status.tone !== 'voided' ? (
            <ButtonLink
              size="sm"
              href={`/app/arena/workspace/${slug}`}
              iconRight={<ArrowRight size={14} aria-hidden />}
            >
              Lanjutkan
            </ButtonLink>
          ) : null}
          <Link
            href={`/app/arena/projects/${slug}`}
            className="inline-flex h-9 items-center rounded-[var(--radius-sk-md)] px-3 text-[12.5px] font-semibold text-sk-muted transition-colors hover:bg-sk-bg hover:text-sk-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
          >
            Lihat brief
          </Link>
        </div>
      </div>
    </article>
  );
}
