'use client';

import { motion } from 'motion/react';
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { DivisionBadge } from './DivisionBadge';
import { RankBadge } from './RankBadge';
import { cn } from '@/lib/cn';

export interface RankingRow {
  rank: number;
  name: string;
  avatarId: string | null;
  division: string | null;
  /** Under the name: the project on a weekly board, the track record all-time. */
  subtitle: string;
  /** Middle column: the division weekly, the best placing all-time. */
  detail: string;
  value: number;
  unit: string;
  /** Right-most column, e.g. "+300" points awarded or "3 minggu". */
  extra: string;
  extraTone?: 'success' | 'muted';
}

/**
 * The full standings under the podium, one row per participant.
 *
 * A real table — rank, person, detail, score, points are columns a screen
 * reader should be able to walk — drawn as separate rounded rows in the
 * alternating cream and white of the podium panel. Rows rise in one after the
 * other on first paint; the viewer's own row gets the blue treatment and a
 * single light sweep so it can be found without reading every name.
 */
export function RankingTable({
  rows,
  caption,
  highlightRank,
  headers,
}: {
  rows: RankingRow[];
  caption: string;
  highlightRank: number | null;
  headers: { detail: string; value: string; extra: string };
}) {
  const reduce = useSettledReducedMotion();
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <table className="w-full border-separate border-spacing-y-2 text-left md:min-w-[620px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-faint">
            <th scope="col" className="w-10 pl-2 pb-1 font-semibold sm:w-14 sm:px-4">#</th>
            <th scope="col" className="px-2 pb-1 font-semibold">Peserta</th>
            <th scope="col" className="hidden px-2 pb-1 font-semibold md:table-cell">{headers.detail}</th>
            <th scope="col" className="px-1.5 pb-1 text-right font-semibold sm:px-2">{headers.value}</th>
            <th scope="col" className="pl-1.5 pr-2.5 pb-1 text-right font-semibold sm:px-4">{headers.extra}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const mine = row.rank === highlightRank;
            const cell = cn(
              'py-3 transition-colors duration-200',
              mine ? 'bg-sk-blue-tint' : index % 2 === 0 ? 'bg-[#fffaf0]' : 'bg-white',
            );
            return (
              <motion.tr
                key={`${row.rank}-${row.name}`}
                className={cn('group', mine && 'relative')}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: 0.9 + Math.min(index, 12) * 0.045 }}
              >
                <td className={cn(cell, 'rounded-l-2xl pl-2 pr-1 sm:pl-4 sm:pr-2', mine ? 'shadow-[inset_2px_0_0_var(--color-sk-blue)]' : 'group-hover:bg-sk-blue-wash')}>
                  <RankBadge rank={row.rank} className="max-sm:h-7 max-sm:w-7 max-sm:text-[11.5px]" />
                </td>
                <td className={cn(cell, 'px-1.5 sm:px-2', !mine && 'group-hover:bg-sk-blue-wash')}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="relative shrink-0">
                      <AvatarBadge avatarId={row.avatarId} seed={row.name} size="sm" className="sm:hidden" />
                      <AvatarBadge avatarId={row.avatarId} seed={row.name} size="md" className="max-sm:hidden" />
                      <DivisionBadge division={row.division} size={17} className="absolute -bottom-0.5 -right-1" />
                    </span>
                    <span className="min-w-0">
                      <span className={cn('flex items-center gap-1.5 text-[13.5px] text-sk-navy', mine ? 'font-extrabold' : 'font-bold')}>
                        <span className="max-w-[104px] truncate sm:max-w-[260px]">{row.name}</span>
                        {mine && <span className="shrink-0 rounded-full bg-sk-blue px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-white">Kamu</span>}
                      </span>
                      <span className="block max-w-[120px] truncate text-[11px] text-sk-muted sm:max-w-[260px] sm:text-[11.5px]">{row.subtitle}</span>
                    </span>
                  </div>
                </td>
                <td className={cn(cell, 'hidden px-2 text-[12.5px] font-semibold text-sk-body md:table-cell', !mine && 'group-hover:bg-sk-blue-wash')}>
                  <span className="inline-flex items-center gap-2">
                    <DivisionBadge division={row.division} size={22} className="ring-0" />
                    {row.detail}
                  </span>
                </td>
                <td className={cn(cell, 'whitespace-nowrap px-1.5 text-right [overflow-wrap:normal] sm:px-2', !mine && 'group-hover:bg-sk-blue-wash')}>
                  <span className="hidden font-mono text-[10px] font-semibold tracking-[0.08em] text-sk-faint sm:inline">{row.unit} </span>
                  <span className="font-mono text-[14px] font-bold tabular-nums text-sk-navy sm:text-[15px]">
                    {row.value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                  </span>
                </td>
                <td
                  className={cn(
                    cell,
                    'whitespace-nowrap rounded-r-2xl pl-1.5 pr-2.5 text-right font-mono text-[12.5px] font-bold tabular-nums [overflow-wrap:normal] sm:pr-4 sm:text-[13px]',
                    row.extraTone === 'success' ? 'text-sk-success' : 'text-sk-muted',
                    !mine && 'group-hover:bg-sk-blue-wash',
                  )}
                >
                  {row.extra}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
