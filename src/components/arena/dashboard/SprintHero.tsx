'use client';

import { motion } from 'motion/react';
import { ArrowRight, FileText, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { ProjectMiniVisual, motifForDivision } from '@/components/landing/ProjectMiniVisual';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { STEP_ORDER, STEP_SHORT, enrollmentStatus, type EnrollmentTone } from '@/lib/dashboard-view';
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

/** The five workspace steps, drawn as a light horizontal tracker. */
function MissionStepper({ current }: { current: (typeof STEP_ORDER)[number] }) {
  const reduce = useSettledReducedMotion();
  const index = STEP_ORDER.indexOf(current);
  return (
    <ol className="mt-6 flex items-center gap-1.5" aria-label="Tahap pengerjaan">
      {STEP_ORDER.map((step, i) => {
        const done = i < index;
        const now = i === index;
        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col gap-2">
            <span
              aria-hidden
              className={cn(
                'block h-1.5 origin-left rounded-full',
                done && 'bg-sk-success',
                now && 'bg-sk-blue',
                !done && !now && 'bg-sk-track',
              )}
              style={reduce ? undefined : { transform: 'scaleX(0)', animation: `stepFill 500ms ease-out ${120 + i * 90}ms forwards` }}
            />
            <span
              className={cn(
                'flex items-center gap-1 truncate font-mono text-[9.5px] uppercase tracking-[0.08em]',
                now ? 'font-bold text-sk-blue' : done ? 'text-sk-success' : 'text-sk-faint',
              )}
              aria-current={now ? 'step' : undefined}
            >
              <motion.span
                aria-hidden
                className={cn(
                  'grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8px] font-bold',
                  done && 'bg-sk-success-tint text-sk-success',
                  now && 'bg-sk-blue-tint text-sk-blue',
                  !done && !now && 'bg-sk-track text-sk-faint',
                )}
                initial={now && !reduce ? { scale: 1 } : undefined}
                animate={now && !reduce ? { scale: [1, 1.18, 1] } : undefined}
                transition={now && !reduce ? { duration: 0.5, delay: 0.55, ease: 'easeOut' } : undefined}
              >
                {done ? '✓' : i + 1}
              </motion.span>
              {STEP_SHORT[step]}
            </span>
          </li>
        );
      })}
      <style>{`@keyframes stepFill { to { transform: scaleX(1); } }`}</style>
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
}

/**
 * The one thing to do next — the strongest visual element on the page.
 *
 * A light white card rather than a dark panel: the "arena" feeling now comes
 * from the stepper, the pills and the motif illustration, not from a
 * different background colour than the rest of the dashboard.
 */
const MISSION: Record<EnrollmentTone, { badge: string; tone: string; body: string | null }> = {
  active: { badge: 'Misi aktif', tone: 'bg-sk-blue text-white', body: null },
  waiting: { badge: 'Menunggu hasil', tone: 'bg-sk-warning-tint text-sk-warning-ink', body: 'Kirimanmu sudah masuk. Hasil terbit begitu sprint difinalisasi.' },
  result: { badge: 'Misi selesai', tone: 'bg-sk-success-tint text-sk-success', body: 'Hasil sudah keluar. Lihat skor, peringkat, dan umpan balik penilaianmu.' },
  sealed: { badge: 'Misi selesai', tone: 'bg-sk-track text-sk-muted', body: 'Sprint ini sudah ditutup dan tidak masuk perhitungan peringkat.' },
  voided: { badge: 'Dibatalkan', tone: 'bg-sk-error-tint text-sk-error', body: 'Pendaftaran proyek ini dibatalkan. Pilih proyek lain di sprint berikutnya.' },
};

export function SprintHero({ name, week, active, focus }: SprintHeroProps) {
  // The badge and sentence follow the enrollment's real state: a finished
  // project must never read "Misi aktif — selesaikan tahap ini".
  const mission = active ? MISSION[enrollmentStatus(active).tone] : null;
  const badge = mission
    ? { label: mission.badge, tone: mission.tone }
    : week?.canSelect
      ? { label: 'Sprint dibuka', tone: 'bg-sk-blue text-white' }
      : { label: 'Sprint berikutnya', tone: 'bg-sk-track text-sk-muted' };
  const title =
    active?.project.title ??
    (week?.canSelect
      ? 'Pilih proyek untuk sprint ini.'
      : 'Siapkan langkahmu untuk sprint berikutnya.');
  const body = active
    ? (mission?.body ?? `${focus?.stage}. Selesaikan tahap ini, lalu kirim sebelum tenggat.`)
    : week?.canSelect
      ? 'Baca brief yang tersedia, pilih yang paling dekat dengan arah kariermu, lalu mulai bekerja.'
      : 'Proyek baru muncul di sini begitu sprint berikutnya dibuka. Sementara itu, lihat hasil sprint sebelumnya.';

  return (
    <motion.section
      aria-labelledby="sprint-hero-title"
      className="rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-6 shadow-sk-xs sm:p-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className={cn('grid gap-8', active && 'lg:grid-cols-[minmax(0,1fr)_260px]')}>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-sk-muted">Halo, {name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]', badge.tone)}>
              {badge.label}
            </span>
            {week && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sk-border bg-sk-bg px-2.5 py-1 font-mono text-[10px] font-semibold text-sk-body">
                <span
                  aria-hidden
                  className={cn('h-1.5 w-1.5 rounded-full', week.canSelect ? 'bg-sk-success' : 'bg-sk-faint')}
                />
                {week.weekCode} · {weekStatusLabels[week.status] ?? week.status}
              </span>
            )}
            {active && (
              <span className="rounded-full border border-sk-border bg-sk-bg px-2.5 py-1 font-mono text-[10px] font-semibold text-sk-body">
                {active.project.division}
              </span>
            )}
          </div>

          <h1
            id="sprint-hero-title"
            className="mt-3 text-[25px] font-extrabold leading-[1.12] tracking-[-0.035em] text-sk-navy sm:text-[32px]"
          >
            {title}
          </h1>
          <p className="mt-2.5 max-w-[56ch] text-[13.5px] leading-relaxed text-sk-muted">
            {body}
          </p>

          {active && focus?.step && (
            <MissionStepper current={focus.step as (typeof STEP_ORDER)[number]} />
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink
              href={focus?.href ?? '/app/arena/projects'}
              size="md"
              variant="primary"
              className="group rounded-full"
              iconRight={
                <ArrowRight size={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-[3px]" />
              }
            >
              {focus?.label ?? 'Jelajahi proyek'}
            </ButtonLink>
            {active ? (
              <ButtonLink
                href={`/app/arena/projects/${encodeURIComponent(active.project.slug)}`}
                size="md"
                variant="ghost"
                className="rounded-full"
                iconLeft={<FileText size={15} aria-hidden />}
              >
                Baca brief
              </ButtonLink>
            ) : (
              <ButtonLink
                href="/app/arena/my-projects"
                size="md"
                variant="ghost"
                className="rounded-full"
                iconLeft={<Sparkles size={15} aria-hidden />}
              >
                Riwayat sprint
              </ButtonLink>
            )}
          </div>
        </div>

        {active && (
          <div
            aria-hidden
            className="hidden overflow-hidden rounded-[var(--radius-sk-2xl)] border border-sk-border shadow-sk-xs lg:block"
          >
            <ProjectMiniVisual motif={motifForDivision('', active.project.division)} className="h-full min-h-[220px]" />
          </div>
        )}
      </div>
    </motion.section>
  );
}
