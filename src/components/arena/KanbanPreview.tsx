import Link from 'next/link';
import { ArrowUpRight, FileText, Link2 } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { ARENA_WEEK } from '@/data/mock/arena';
import { mockProjects } from '@/data/mock/projects';

const KIND_ICON = { dataset: FileText, document: FileText, template: FileText, link: Link2 };

/** Resource line used in project detail + workspace sidebar. */
export function ResourceList({
  resources,
  dark,
}: {
  resources: { id: string; title: string; kind: string }[];
  dark?: boolean;
}) {
  return (
    <ul className={dark ? 'text-[13px] leading-[1.9] text-white/85' : 'text-[12.5px] leading-[1.9] text-sk-body'}>
      {resources.map((r) => {
        const Icon = KIND_ICON[r.kind as keyof typeof KIND_ICON] ?? FileText;
        return (
          <li key={r.id} className="flex items-center gap-2">
            <Icon size={13} aria-hidden className={dark ? 'text-white/60' : 'text-sk-muted'} />
            <span className="font-mono">{r.title}</span>
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
