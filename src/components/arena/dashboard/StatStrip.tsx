import Link from 'next/link';
import { ArrowUpRight, Award, Coins, FolderCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { CountUp } from './CountUp';
import { bestRanking } from '@/lib/dashboard-view';
import type { ParticipantOverview } from '@/lib/participant-client';
import { cn } from '@/lib/cn';

interface Tile {
  label: string;
  value: number | string;
  /** The line under the number — what it means, or what it takes to move it. */
  caption: string;
  href: string;
  icon: LucideIcon;
  accent: string;
}

/**
 * One tile: a number, what it means, and somewhere to go.
 *
 * The old strip was three bare counts in white boxes. A count with no context
 * and no destination is a decoration — "240 poin" does not say whether that is
 * a lot, and tapping it did nothing. Each tile now carries a caption and is
 * itself the link to the page that explains it.
 */
function StatTile({ label, value, caption, href, icon: Icon, accent }: Tile) {
  return (
    <li className="flex">
      <Link
        href={href}
        className="card-rise group relative flex w-full min-h-[104px] flex-col justify-between gap-3 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue sm:p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11.5px] font-semibold leading-tight text-sk-muted">{label}</span>
          <span
            aria-hidden
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sk)]',
              accent,
            )}
          >
            <Icon size={14} strokeWidth={2.4} />
          </span>
        </div>
        <div>
          <p className="font-mono text-[26px] font-bold leading-none tracking-[-0.045em] text-sk-navy sm:text-[28px]">
            {typeof value === 'number' ? <CountUp value={value} /> : value}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] leading-snug text-sk-faint">
            {caption}
            <ArrowUpRight
              size={11}
              aria-hidden
              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </p>
        </div>
      </Link>
    </li>
  );
}

/**
 * Four numbers that between them answer "how am I doing here".
 *
 * `lifetimeEarned` and the best placing were both already in the payload and
 * both thrown away by the old dashboard; they are what turns a balance into a
 * track record.
 */
export function StatStrip({ data }: { data: ParticipantOverview }) {
  const best = bestRanking(data.history);
  const attempted = data.history.filter((row) => row.status !== 'VOIDED').length;

  const tiles: Tile[] = [
    {
      label: 'Poin tersedia',
      value: data.points.balance,
      caption: `${data.points.lifetimeEarned.toLocaleString('id-ID')} poin total diperoleh`,
      href: '/app/profile#rewards',
      icon: Coins,
      accent: 'bg-sk-blue-tint text-sk-blue',
    },
    {
      label: 'Project selesai',
      value: data.completedProjects,
      caption: attempted ? `dari ${attempted} project yang diambil` : 'belum ada project diambil',
      href: '/app/arena/my-projects',
      icon: FolderCheck,
      accent: 'bg-sk-success-tint text-sk-success',
    },
    {
      label: 'Skill terbukti',
      value: data.provenSkills,
      caption: 'tercatat di Career Report',
      href: '/app/career-report',
      icon: Sparkles,
      accent: 'bg-sk-warning-tint text-sk-warning-ink',
    },
    {
      label: 'Peringkat terbaik',
      value: best?.ranking ? `#${best.ranking.rank}` : '—',
      caption: best?.ranking
        ? `skor ${best.ranking.finalScore}/100`
        : 'selesaikan satu sprint dulu',
      href: '/app/arena/leaderboard',
      icon: Award,
      accent: 'bg-sk-violet-tint text-sk-violet',
    },
  ];

  return (
    <ul aria-label="Ringkasan capaian" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <StatTile key={tile.label} {...tile} />
      ))}
    </ul>
  );
}
