import { CalendarOff } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { Reveal } from '@/components/motion/Reveal';
import { ProjectPreviewCard, type LandingProject } from '@/components/landing/ProjectPreviewCard';
import { ARENA_ENTRY_LABEL } from '@/components/landing/arena-entry';

const APPEAR = { y: 100, duration: 0.8, ease: [0.44, 0, 0.56, 1] as [number, number, number, number] };

/**
 * The live briefs, or an honest statement that there are none.
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
  completionPoints,
  projectCount,
}: {
  projects: LandingProject[];
  entryHref: string;
  deadline: string | null;
  completionPoints: number | null;
  projectCount: number;
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

  return (
    <>
      <Reveal {...APPEAR}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Dibuka minggu ini</span>
            <h2
              id="proyek-aktif"
              className="mt-2.5 text-[26px] font-extrabold tracking-[-0.03em] text-sk-navy md:text-[32px]"
            >
              Project yang sedang berjalan.
            </h2>
          </div>
          {hidden > 0 && (
            <p className="text-[13px] font-semibold text-sk-muted">
              +{hidden} project lain menunggu di dalam Arena
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
              completionPoints={completionPoints}
            />
          </Reveal>
        ))}
      </div>
    </>
  );
}
