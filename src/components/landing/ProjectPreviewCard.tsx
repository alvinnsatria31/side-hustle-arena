import Link from 'next/link';
import { CalendarClock, FileCheck2, Sparkles } from 'lucide-react';
import { ProjectMiniVisual, motifForDivision } from '@/components/landing/ProjectMiniVisual';

export interface LandingProject {
  slug: string;
  title: string;
  category: string;
  categorySlug: string;
  deliverable: string;
  estimatedTime: string;
  coverImageUrl: string | null;
}

/**
 * A brief, as a preview of the work rather than a paragraph about it.
 *
 * These three cards are the landing page's strongest claim — that something
 * real is running this week — so every field on them is read from the live
 * week and nothing is padded. A field the data does not have is left off the
 * card; there is no placeholder for a missing deadline and no invented
 * participant count.
 *
 * The whole card is one link into the Arena dashboard. It does not open a
 * public project page: the brief is the product, and a visitor who is ready to
 * click a project is ready to walk through the door. Signed out, `href`
 * resolves to the Sekolah Karir sign-in that continues to the same dashboard.
 */
export function ProjectPreviewCard({
  project,
  href,
  deadline,
  completionPoints,
}: {
  project: LandingProject;
  href: string;
  /** The week's submission deadline, already worded. */
  deadline: string | null;
  /** Points for finishing, when the week's rules declare any. */
  completionPoints: number | null;
}) {
  const motif = motifForDivision(project.categorySlug, project.category);

  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-sk-blue-tint-border hover:shadow-sk-lg focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-sk-border bg-sk-blue-wash">
        {project.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <ProjectMiniVisual motif={motif} />
        )}

        <span className="absolute left-3.5 top-3.5 inline-flex items-center rounded-full border border-sk-blue-tint-border bg-white/90 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-sk-blue-700 backdrop-blur">
          {project.category}
        </span>

        {completionPoints !== null && (
          <span className="absolute right-3.5 top-3.5 inline-flex items-center gap-1 rounded-full border border-sk-warning-tint bg-white/90 px-2.5 py-1 text-[11px] font-bold text-sk-warning-ink backdrop-blur">
            <Sparkles size={11} strokeWidth={2.6} aria-hidden />
            {completionPoints} poin
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <h3 className="text-[17px] font-bold leading-snug tracking-[-0.03em] text-sk-navy">{project.title}</h3>

        <div className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-sk-md)] bg-sk-bg px-3.5 py-3">
          <FileCheck2 size={15} strokeWidth={2.2} aria-hidden className="mt-0.5 flex-none text-sk-success" />
          <span className="min-w-0">
            <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-sk-faint">
              Hasil buat portofolio
            </span>
            <span className="mt-1 block line-clamp-2 text-[13px] font-semibold leading-snug text-sk-body">
              {project.deliverable}
            </span>
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-5 text-[12.5px] font-semibold text-sk-muted">
          {deadline ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={14} strokeWidth={2.2} aria-hidden className="text-sk-faint" />
              {deadline}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">{project.estimatedTime}</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-sk-blue">
            Ambil brief
          </span>
        </div>
      </div>
    </Link>
  );
}
