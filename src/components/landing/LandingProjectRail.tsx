import { CalendarOff } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { Reveal } from '@/components/motion/Reveal';
import { ProjectPreviewCard, type LandingProject } from '@/components/landing/ProjectPreviewCard';
import { ARENA_ENTRY_LABEL } from '@/components/landing/arena-entry';
import type { WeekPhase } from '@/lib/week-phase';

const APPEAR = { y: 100, duration: 0.8, ease: [0.44, 0, 0.56, 1] as [number, number, number, number] };

const RAIL_COPY: Record<WeekPhase, { eyebrow: string; title: string; note: string | null }> = {
  open: { eyebrow: 'Dibuka minggu ini', title: 'Project yang sedang berjalan.', note: null },
  upcoming: {
    eyebrow: 'Segera dibuka',
    title: 'Project sprint berikutnya.',
    note: 'Pendaftaran belum dibuka. Masuk ke Arena supaya kamu siap memilih begitu sprint dimulai.',
  },
  closed: {
    eyebrow: 'Sprint terakhir',
    title: 'Project dari sprint terakhir.',
    note: 'Pendaftaran sprint ini sudah ditutup. Masuk ke Arena supaya kamu siap begitu brief berikutnya dibuka.',
  },
};

/**
 * The live briefs, or an honest statement that there are none.
 *
 * A week that is over, or not open yet, is a third case, and it must not borrow
 * the open week's wording: "Dibuka minggu ini" over cards that say "Ambil brief",
 * directly under a hero that says enrolment is closed, is the page contradicting
 * itself. Those weeks are shown as what they are.
 *
 * Three is a cap, not a target: a week with one published brief shows one card
 * in a grid that does not stretch it into filling three columns, and a week
 * with none shows the empty state. Neither case is padded with an archived
 * project or a "coming soon" card carrying an invented title, because the
 * whole reason this block sits under the hero is that a visitor can trust what
 * it says is running today.
 */
export function LandingProjectRail({
  projects,
  entryHref,
  deadline,
  maxPoints,
  projectCount,
  phase,
}: {
  projects: LandingProject[];
  entryHref: string;
  deadline: string | null;
  maxPoints: number | null;
  projectCount: number;
  /** Open, not open yet, or over. */
  phase: WeekPhase;
}) {
  if (projects.length === 0) {
    return (
      <Reveal {...APPEAR}>
        <div className="rounded-[var(--radius-sk-3xl)] border border-dashed border-sk-blue-tint-border bg-white/70 px-6 py-14 text-center backdrop-blur">
          <span
            aria-hidden
            className="mx-auto grid h-12 w-12 place-items-center rounded-[var(--radius-sk-lg)] border border-sk-blue-tint-border bg-sk-blue-tint text-sk-blue-700"
          >
            <CalendarOff size={21} strokeWidth={2.1} />
          </span>
          <h2 id="proyek-aktif" className="mt-5 text-[22px] font-extrabold tracking-[-0.03em] text-sk-navy md:text-[26px]">
            Sprint berikutnya segera hadir.
          </h2>
          <p className="mx-auto mt-2.5 max-w-[42ch] text-[14.5px] leading-relaxed text-sk-muted">
            Belum ada project yang dibuka saat ini. Masuk ke Arena supaya kamu siap
            begitu brief minggu berikutnya keluar.
          </p>
          <div className="mt-7">
            <ButtonLink
              href={entryHref}
              size="lg"
              className="rounded-full"
            >
              {ARENA_ENTRY_LABEL}
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    );
  }

  const hidden = Math.max(0, projectCount - projects.length);
  const copy = RAIL_COPY[phase];

  return (
    <>
      <Reveal {...APPEAR}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">{copy.eyebrow}</span>
            <h2
              id="proyek-aktif"
              className="mt-2.5 text-[26px] font-extrabold tracking-[-0.03em] text-sk-navy md:text-[32px]"
            >
              {copy.title}
            </h2>
            {copy.note && (
              <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-sk-muted">{copy.note}</p>
            )}
          </div>
          {hidden > 0 && (
            <p className="text-[13px] font-semibold text-sk-muted">
              {phase === 'open' ? `+${hidden} project lain menunggu di dalam Arena` : `+${hidden} project lain di sprint ini`}
            </p>
          )}
        </div>
      </Reveal>

      <div
        className={
          projects.length === 1
            ? 'mt-8 grid gap-5 sm:max-w-md'
            : projects.length === 2
              ? 'mt-8 grid gap-5 sm:grid-cols-2'
              : 'mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3'
        }
      >
        {projects.map((project) => (
          <Reveal key={project.slug} className="h-full" {...APPEAR}>
            <ProjectPreviewCard
              project={project}
              href={entryHref}
              deadline={deadline}
              maxPoints={maxPoints}
              phase={phase}
            />
          </Reveal>
        ))}
      </div>
    </>
  );
}
