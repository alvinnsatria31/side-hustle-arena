import Link from 'next/link';
import { ArrowUpRight, FileText, Link2 } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { ARENA_WEEK } from '@/data/mock/arena';
import { mockProjects } from '@/data/mock/projects';

const KIND_ICON = { dataset: FileText, document: FileText, template: FileText, link: Link2 };

/**
 * Resource line used in project detail + workspace sidebar.
 *
 * The title alone was the whole component, which made a brief that says
 * "analyse the attached dataset" unanswerable: the participant could read the
 * name of the file and had no way to reach it. A resource with a URL now
 * renders as a real anchor. One without stays plain text rather than becoming a
 * dead link — the mock catalogue has no URLs, and an anchor that goes nowhere is
 * worse than an honest label.
 */
export function ResourceList({
  resources,
  dark,
}: {
  resources: { id: string; title: string; kind: string; url?: string }[];
  dark?: boolean;
}) {
  if (resources.length === 0) {
    return (
      <p className={dark ? 'text-[13px] text-white/60' : 'text-[12.5px] text-sk-muted'}>
        Belum ada bahan tambahan untuk project ini — semua yang dibutuhkan ada di brief.
      </p>
    );
  }
  return (
    <ul className={dark ? 'text-[13px] leading-[1.9] text-white/85' : 'text-[12.5px] leading-[1.9] text-sk-body'}>
      {resources.map((r) => {
        const Icon = KIND_ICON[r.kind as keyof typeof KIND_ICON] ?? FileText;
        return (
          <li key={r.id} className="flex items-center gap-2">
            <Icon size={13} aria-hidden className={dark ? 'shrink-0 text-white/60' : 'shrink-0 text-sk-muted'} />
            {r.url ? (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  dark
                    ? 'inline-flex min-w-0 items-center gap-1 font-mono underline decoration-white/40 underline-offset-2 transition-colors hover:text-white'
                    : 'inline-flex min-w-0 items-center gap-1 font-mono text-sk-blue underline decoration-sk-blue/40 underline-offset-2 transition-colors hover:text-sk-blue-700'
                }
              >
                <span className="truncate">{r.title}</span>
                <ArrowUpRight size={11} aria-hidden className="shrink-0" />
                <span className="sr-only">(buka di tab baru)</span>
              </a>
            ) : (
              <span className="truncate font-mono">{r.title}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Kanban-style "this week's drop" preview card (arena landing right column). */
export function KanbanPreview({
  projects,
  weekLabel,
  total,
}: {
  /** Live projects (top 4). Defaults to the mock catalog until wired. */
  projects?: Array<{ slug: string; title: string; category: string }>;
  weekLabel?: string;
  total?: number;
} = {}) {
  const weekly = (projects ?? mockProjects.filter((p) => p.isThisWeek)).slice(0, 4);
  const label = weekLabel ?? `WEEK ${ARENA_WEEK} · SEP 2`;
  const count = total ?? weekly.length * 3;
  return (
    <div className="rounded-[var(--radius-sk-2xl)] bg-white p-5 shadow-[0_30px_60px_-30px_rgba(7,21,45,0.3)]">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.1em] text-sk-muted">
          {label}
        </span>
        <Badge>Fresh Drop</Badge>
      </div>
      <div className="mb-[18px] border-b border-dashed border-sk-border pb-5 pt-2 text-center">
        <div className="text-[52px] font-extrabold leading-none tracking-[-0.03em] text-sk-blue">{count}</div>
        <div className="mt-1.5 font-mono text-[10.5px] tracking-[0.14em] text-sk-muted">PROJECT MINGGU INI</div>
      </div>
      <ul className="flex flex-col gap-2.5">
        {weekly.map((p, i) => (
          <li
            key={p.slug}
            className={i === 0 ? 'flex items-center gap-3 rounded-xl border border-sk-blue bg-[#F7FAFF] p-3 shadow-[0_0_0_4px_rgba(36,107,253,0.1)]' : 'flex items-center gap-3 rounded-xl border border-sk-border p-3'}
          >
            <div className="min-w-0">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-sk-muted">{p.category}</div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-sk-navy">{p.title}</div>
            </div>
            <Link
              href={`/arena/projects/${p.slug}`}
              className="ml-auto inline-flex shrink-0 items-center font-mono text-[11px] font-semibold text-sk-blue hover:underline"
              aria-label={`Lihat ${p.title}`}
            >
              Lihat
              <ArrowUpRight size={11} className="ml-0.5 inline" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
