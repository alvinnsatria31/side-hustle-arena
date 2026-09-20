'use client';

import { ArrowRight, CalendarClock, Check, FileText, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { ProgressRing } from './ProgressRing';
import { SprintCountdown } from './SprintCountdown';
import { STEP_ORDER, STEP_SHORT, type DeadlineTone } from '@/lib/dashboard-view';
import type { ParticipantEnrollment, ParticipantOverview } from '@/lib/participant-client';
import { cn } from '@/lib/cn';

const weekStatusLabels: Record<string, string> = {
  SCHEDULED: 'Dijadwalkan',
  PREVIEW: 'Segera dibuka',
  OPEN: 'Sedang dibuka',
  CLOSED: 'Ditutup',
  FINALIZING: 'Menunggu hasil akhir',
  FINALIZED: 'Selesai',
};

const deadlineTone: Record<DeadlineTone, string> = {
  over: 'text-sk-deadline',
  critical: 'text-sk-deadline',
  urgent: 'text-sk-deadline',
  calm: 'text-sk-on-navy',
};

/** The five workspace steps, drawn on the dark panel. */
function DarkStepper({ current }: { current: (typeof STEP_ORDER)[number] }) {
  const index = STEP_ORDER.indexOf(current);
  return (
    <ol className="mt-6 flex items-center gap-1.5" aria-label="Tahap pengerjaan">
      {STEP_ORDER.map((step, i) => {
        const done = i < index;
        const now = i === index;
        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              aria-hidden
              className={cn(
                'h-1.5 rounded-full transition-colors duration-300',
                done && 'bg-sk-mint',
                now && 'bg-white',
                !done && !now && 'bg-sk-on-navy-track',
              )}
            />
            <span
              className={cn(
                'flex items-center gap-1 truncate font-mono text-[9.5px] uppercase tracking-[0.08em]',
                now ? 'font-bold text-white' : done ? 'text-sk-mint' : 'text-sk-on-navy-body/60',
              )}
              aria-current={now ? 'step' : undefined}
            >
              {done && <Check size={9} strokeWidth={3.5} aria-hidden />}
              {STEP_SHORT[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface SprintHeroProps {
  name: string;
  week: ParticipantOverview['currentWeek'];
  active: ParticipantEnrollment | null;
  focus: {
    label: string;
    href: string;
    progress: number;
    stage: string;
    step: string | null;
  } | null;
  dateLabel: (value: string) => string;
}

/**
 * The one thing to do next, and how long there is to do it.
 *
 * Three states share this panel: a sprint in progress (stepper, ring, live
 * countdown), an open week with nothing picked yet (browse), and a week that
 * has not opened (wait). They share a frame on purpose — the participant
 * learns one place to look, and the frame answers "am I behind?" before they
 * read a word.
 */
export function SprintHero({ name, week, active, focus, dateLabel }: SprintHeroProps) {
  const deadline = active?.week.submissionDeadlineAt ?? week?.submissionDeadlineAt ?? null;
  const title =
    active?.project.title ??
    (week?.canSelect
      ? 'Pilih project untuk sprint ini.'
      : 'Siapkan langkahmu untuk sprint berikutnya.');
  const body = active
    ? `${focus?.stage}. Selesaikan tahap ini, lalu kirim sebelum tenggat.`
    : week?.canSelect
      ? 'Baca brief yang tersedia, pilih yang paling dekat dengan arah kariermu, lalu mulai bekerja.'
      : 'Project baru muncul di sini begitu sprint berikutnya dibuka. Sementara itu, lihat hasil sprint sebelumnya.';

  return (
    <section aria-labelledby="sprint-hero-title" className="sprint-hero p-6 sm:p-8">
      <div className="relative z-10 grid gap-7 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-sk-on-navy-accent">
              Halo, {name}
            </span>
            {week && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-sk-on-navy-body">
                <span
                  aria-hidden
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    week.canSelect ? 'bg-sk-mint' : 'bg-sk-on-navy-accent',
                  )}
                />
                {week.weekCode} · {weekStatusLabels[week.status] ?? week.status}
              </span>
            )}
          </div>

          <h1
            id="sprint-hero-title"
            className="mt-3 text-[25px] font-extrabold leading-[1.12] tracking-[-0.035em] sm:text-[32px]"
          >
            {title}
          </h1>
          <p className="mt-2.5 max-w-[56ch] text-[13.5px] leading-relaxed text-sk-on-navy-body">
            {body}
          </p>

          {active && focus?.step && (
            <DarkStepper current={focus.step as (typeof STEP_ORDER)[number]} />
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink
              href={focus?.href ?? '/app/arena/projects'}
              size="md"
              variant="white"
              className="rounded-full"
              iconRight={<ArrowRight size={16} aria-hidden />}
            >
              {focus?.label ?? 'Jelajahi proyek'}
            </ButtonLink>
            {active ? (
              <ButtonLink
                href={`/app/arena/projects/${encodeURIComponent(active.project.slug)}`}
                size="md"
                variant="ghostOnDark"
                className="rounded-full"
                iconLeft={<FileText size={15} aria-hidden />}
              >
                Baca brief
              </ButtonLink>
            ) : (
              <ButtonLink
                href="/app/arena/my-projects"
                size="md"
                variant="ghostOnDark"
                className="rounded-full"
                iconLeft={<Sparkles size={15} aria-hidden />}
              >
                Riwayat sprint
              </ButtonLink>
            )}
          </div>
        </div>

        {/* Deadline panel — the urgency half of the hero. */}
        {deadline && (
          <aside className="side-mini flex items-center gap-5 lg:flex-col lg:items-stretch lg:gap-5 lg:self-start">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-sk-on-navy-body">
                <CalendarClock size={12} aria-hidden />
                Batas pengumpulan
              </p>
              <SprintCountdown deadlineAt={deadline}>
                {({ text, tone }) => (
                  <p
                    className={cn(
                      'mt-2 text-[20px] font-extrabold leading-tight tracking-[-0.03em]',
                      deadlineTone[tone],
                    )}
                  >
                    {text}
                  </p>
                )}
              </SprintCountdown>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-sk-on-navy-body/80">
                {dateLabel(deadline)} WIB
              </p>
            </div>
            {focus && (
              <ProgressRing
                value={focus.progress}
                size={88}
                label={`Progres pengerjaan ${focus.progress} persen`}
                className="lg:self-end"
              />
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
