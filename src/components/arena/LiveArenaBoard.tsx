import Link from 'next/link';
import { ArrowRight, Clock3 } from 'lucide-react';
import { DeadlineCountdown } from '@/components/arena/DeadlineCountdown';

export interface LiveArenaProject {
  slug: string;
  title: string;
  category: string;
  estimatedTime: string;
  deliverable: string;
  participantCount: number;
}

export function LiveArenaBoard({
  projects,
  weekNo,
  deadline,
  deadlineAt,
}: {
  projects: LiveArenaProject[];
  weekNo?: number;
  deadline?: string;
  deadlineAt?: string;
}) {
  const latestProject = projects[0];

  return (
    <section
      aria-labelledby="live-arena-title"
      className="overflow-hidden rounded-[18px] bg-white shadow-[0_26px_58px_-30px_rgba(7,21,45,0.36)]"
    >
      <div className="flex items-center justify-between gap-4 bg-[#F7F8FF] px-4 py-4 sm:min-h-[58px] sm:px-6 sm:py-0">
        <Link
          id="live-arena-title"
          href="/arena/projects"
          className="text-[16px] font-extrabold tracking-[-0.02em] text-sk-navy transition-colors hover:text-sk-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-blue focus-visible:ring-offset-4 sm:text-[19px]"
        >
          LIVE ARENA BOARD
        </Link>
        <Link
          href="/arena/projects"
          className="shrink-0 rounded-md bg-[#E5E9F5] px-2.5 py-1.5 text-[11px] font-extrabold text-sk-navy transition-colors hover:bg-[#D9DFEF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-blue focus-visible:ring-offset-2 sm:text-[13px]"
        >
          {weekNo ? `BATCH ${weekNo}` : 'ARENA'}
        </Link>
      </div>

      <div className="p-3.5 sm:px-6 sm:pb-6 sm:pt-4">
        {deadline && (
          <div className="mb-4 flex min-h-[40px] flex-wrap items-center justify-between gap-2 rounded-md bg-[#FDE8E6] px-4 py-2.5 text-[#9F101A]">
            <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase sm:text-[13px]">
              <Clock3 size={17} strokeWidth={2.3} aria-hidden />
              Deadline {deadline}
            </span>
            <strong className="text-[13px] tabular-nums sm:text-[15px]">
              {deadlineAt ? <DeadlineCountdown deadlineAt={deadlineAt} /> : deadline}
            </strong>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="rounded-xl border border-[#E2E6F4] bg-[#F1F3FE] px-5 py-9 text-center">
            <p className="font-bold text-sk-navy">Belum ada event aktif</p>
            <Link href="/arena/projects" className="mt-2 inline-flex min-h-11 items-center font-semibold text-sk-blue hover:underline">
              Lihat arsip project
            </Link>
          </div>
        ) : (
          <ul className="grid gap-2">
            {projects.map((project) => (
              <li key={project.slug} className="flex rounded-xl border border-[#E3E7F4] bg-[#F0F2FD] px-3.5 py-3 shadow-[0_3px_8px_rgba(14,31,69,0.05)] sm:h-[132px] sm:flex-col sm:px-4 sm:py-3.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#555D70] sm:text-[13px]">
                      <span className="rounded bg-[#DCE5FF] px-1.5 py-0.5 font-extrabold uppercase tracking-[0.08em] text-[#102A54]">
                        {project.category}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={15} aria-hidden />
                        {project.estimatedTime}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#0866BE] sm:text-[13px]">
                      <span className="h-2 w-2 rounded-full bg-[#0874C9]" aria-hidden />
                      {project.participantCount} Talenta
                    </span>
                  </div>

                  <h3 className="mt-2 text-[15px] font-extrabold leading-snug tracking-[-0.015em] text-sk-navy sm:text-[17px]">
                    {project.title}
                  </h3>

                  <div className="mt-2 flex flex-col gap-1.5 text-[12px] text-[#555D70] sm:mt-auto sm:flex-row sm:items-end sm:justify-between sm:pt-3 sm:text-[13px]">
                    <p className="min-w-0 leading-relaxed">
                      Deliverable: <strong className="font-bold text-sk-navy">{project.deliverable}</strong>
                    </p>
                    <Link
                      href={`/arena/projects/${project.slug}`}
                      aria-label={`Ikuti project ${project.title}`}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 self-start font-extrabold text-[#064CB2] transition-colors hover:text-sk-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-blue focus-visible:ring-offset-2 sm:min-h-0 sm:self-auto sm:text-[13px]"
                    >
                      Ikuti <ArrowRight size={15} aria-hidden />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {latestProject && (
          <Link
            href={`/arena/projects/${latestProject.slug}`}
            className="mt-3.5 flex min-h-[40px] flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-[#E9ECF8] px-3.5 py-1.5 text-[11px] text-[#555D70] transition-colors hover:bg-[#DEE4F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-blue sm:text-[13px]"
          >
            <span className="h-2 w-2 rounded-full bg-[#0874C9]" aria-hidden />
            <strong className="text-sk-navy">Project aktif</strong>
            <span className="min-w-0 truncate font-bold text-[#064CB2]">“{latestProject.title}”</span>
            <span className="ml-auto text-[#727889]">baru tersedia</span>
          </Link>
        )}
      </div>
    </section>
  );
}
