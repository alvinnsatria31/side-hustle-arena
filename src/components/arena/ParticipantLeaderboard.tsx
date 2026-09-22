'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { useParticipant } from '@/features/arena/participant';
import { ArenaApiError, getAllTimeLeaderboard, getLeaderboard, type AllTimeLeaderboardResponse, type LeaderboardResponse } from '@/lib/arena-client';
import { getParticipantOverview, getParticipantPoints, useParticipantResource } from '@/lib/participant-client';
import { myWeekRanking } from '@/lib/dashboard-view';
import { AvatarBadge } from './AvatarBadge';
import { RefreshButton, ResourceState, participantDate } from './ParticipantDashboard';
import { ClimbGuide } from './leaderboard/ClimbGuide';
import { Podium, type PodiumEntry } from './leaderboard/Podium';
import { RankBadge } from './leaderboard/RankBadge';
import { RankingTable, type RankingRow } from './leaderboard/RankingTable';
import { cn } from '@/lib/cn';

type Scope = 'week' | 'all';

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: 'week', label: 'Mingguan' },
  { value: 'all', label: 'Sepanjang waktu' },
];

function ScopeTabs({ scope, onChange }: { scope: Scope; onChange: (scope: Scope) => void }) {
  return (
    <div role="tablist" aria-label="Rentang peringkat" className="inline-flex rounded-full bg-white/85 p-1 shadow-sk-xs ring-1 ring-[#efdfb0]">
      {SCOPES.map((item) => {
        const active = item.value === scope;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative h-9 rounded-full px-4 text-[13px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue',
              active ? 'text-sk-navy' : 'text-sk-muted hover:text-sk-navy',
            )}
          >
            {active && (
              <motion.span
                layoutId="leaderboard-scope"
                className="absolute inset-0 rounded-full bg-[#ffd65c] shadow-[0_6px_14px_-8px_rgba(190,130,10,0.7)]"
                transition={{ type: 'spring', bounce: 0.22, duration: 0.45 }}
              />
            )}
            <span className="relative">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The "you are here" chip in the podium's corner. */
function ViewerChip({ name, avatarId, rank, value, unit }: { name: string; avatarId: string | null; rank: number | null; value: number | null; unit: string }) {
  return (
    <motion.div
      className="flex items-center gap-2.5 rounded-full bg-white/90 py-1.5 pl-1.5 pr-2 shadow-sk-xs ring-1 ring-[#efdfb0] backdrop-blur"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
    >
      <AvatarBadge avatarId={avatarId} seed={name} size="sm" />
      <span className="min-w-0 leading-tight">
        <span className="block max-w-[120px] truncate text-[12px] font-bold text-sk-navy">{name}</span>
        <span className="block font-mono text-[10.5px] text-sk-muted">
          {value === null ? 'Belum masuk peringkat' : `${unit} ${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}`}
        </span>
      </span>
      {rank !== null && <RankBadge rank={rank} className="h-7 w-7 text-[11.5px]" />}
    </motion.div>
  );
}

function EmptyBoard({ weekly }: { weekly: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 pb-12 pt-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#e8a50c] shadow-sk-xs">
        <Trophy size={24} aria-hidden />
      </span>
      <p className="text-[15px] font-bold text-sk-navy">
        {weekly ? 'Peringkat minggu ini belum diumumkan.' : 'Belum ada peringkat yang diumumkan.'}
      </p>
      <p className="max-w-sm text-[13px] leading-relaxed text-sk-muted">
        Papan diisi setelah minggu difinalisasi. Selesaikan kirimanmu dulu, posisimu muncul di sini.
      </p>
      <Link href="/app/arena/projects" className="inline-flex h-11 items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline">
        Jelajahi proyek
      </Link>
    </div>
  );
}

function weeklyView(data: LeaderboardResponse): { podium: PodiumEntry[]; rows: RankingRow[] } {
  return {
    podium: data.rows.slice(0, 3).map((row) => ({ rank: row.rank, name: row.displayName, avatarId: row.avatarId, division: row.divisionName, value: row.finalScore, unit: 'SKOR' })),
    rows: data.rows.map((row) => ({
      rank: row.rank,
      name: row.displayName,
      avatarId: row.avatarId,
      division: row.divisionName,
      subtitle: row.projectTitle,
      detail: row.divisionName,
      value: row.finalScore,
      unit: 'SKOR',
      extra: `+${row.pointsAwarded}`,
      extraTone: 'success',
    })),
  };
}

function allTimeView(data: AllTimeLeaderboardResponse): { podium: PodiumEntry[]; rows: RankingRow[] } {
  return {
    podium: data.rows.slice(0, 3).map((row) => ({ rank: row.rank, name: row.displayName, avatarId: row.avatarId, division: row.latestDivisionName, value: row.totalPoints, unit: 'POIN' })),
    rows: data.rows.map((row) => ({
      rank: row.rank,
      name: row.displayName,
      avatarId: row.avatarId,
      division: row.latestDivisionName,
      subtitle: `Rata-rata skor ${row.averageScore.toLocaleString('id-ID', { maximumFractionDigits: 1 })}`,
      detail: `Terbaik #${row.bestRank}`,
      value: row.totalPoints,
      unit: 'POIN',
      extra: `${row.weeksRanked} minggu`,
      extraTone: 'muted',
    })),
  };
}

/**
 * Peringkat — the Arena's scoreboard, laid out after the CardChase leaderboard
 * the owner picked (Dribbble shot 26731284): a warm stage with the top three
 * on 3D steps, the full standings as rows beneath, and a side column with the
 * viewer's own card and how to climb.
 *
 * "Mingguan" is one finalized week (the latest, or one the viewer took part
 * in); "Sepanjang waktu" sums every finalized week's awarded points. Nothing
 * unfinalized is ever shown — the server refuses it before this page could.
 */
export default function ParticipantLeaderboard() {
  const user = useParticipant();
  const [scope, setScope] = useState<Scope>('week');
  const [week, setWeek] = useState('');
  const overview = useParticipantResource(getParticipantOverview);
  const points = useParticipantResource(useCallback(() => getParticipantPoints(), []));
  const weekly = useParticipantResource(useCallback(() => getLeaderboard(week || undefined), [week]));
  const allTime = useParticipantResource(useCallback(() => (scope === 'all' ? getAllTimeLeaderboard() : Promise.resolve(null)), [scope]));

  const history = overview.data?.history ?? [];
  const weeks = Array.from(new Map(history.filter((row) => row.week.status === 'FINALIZED').map((row) => [row.week.weekCode, row.week])).values());
  const unpublished = weekly.error instanceof ArenaApiError && ['WEEK_NOT_FOUND', 'WEEK_NOT_FINALIZED'].includes(weekly.error.code);
  const refresh = () => {
    void overview.refresh();
    void weekly.refresh();
    void allTime.refresh();
    void points.refresh();
  };

  const name = user.displayName ?? 'Peserta';
  const weekMe = weekly.data ? myWeekRanking(history, weekly.data.weekCode) : null;
  const isWeek = scope === 'week';
  const board = isWeek ? weekly : allTime;
  const view = isWeek ? (weekly.data ? weeklyView(weekly.data) : null) : allTime.data ? allTimeView(allTime.data) : null;
  const highlightRank = isWeek ? (weekMe?.rank ?? null) : (allTime.data?.viewer?.rank ?? null);
  const chip = isWeek
    ? { rank: weekMe?.rank ?? null, value: weekMe?.finalScore ?? null, unit: 'SKOR' }
    : { rank: allTime.data?.viewer?.rank ?? null, value: allTime.data?.viewer?.totalPoints ?? null, unit: 'POIN' };
  const heading = isWeek ? (weekly.data ? `Peringkat ${weekly.data.weekCode}` : 'Peringkat mingguan') : 'Peringkat sepanjang waktu';
  const stamp = isWeek
    ? weekly.data?.finalizedAt
      ? `Final ${participantDate(String(weekly.data.finalizedAt))} WIB`
      : null
    : allTime.data
      ? `Dari ${allTime.data.weeksCounted} minggu yang sudah final`
      : null;
  const contentKey = `${scope}-${isWeek ? (weekly.data?.weekCode ?? 'none') : 'all'}`;
  const empty = isWeek ? unpublished || (weekly.data?.rows.length ?? 0) === 0 : (allTime.data?.rows.length ?? 0) === 0;

  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <motion.div
        className="mb-6 flex flex-wrap items-start justify-between gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-[-0.035em] text-sk-navy sm:text-[32px]">Peringkat</h1>
          <p className="mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-sk-muted">
            Siapa yang paling bersinar minggu ini, dan siapa yang paling konsisten sepanjang Arena.
          </p>
        </div>
        <RefreshButton refresh={refresh} loading={board.loading || overview.loading} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <motion.section
          aria-labelledby="leaderboard-heading"
          className="min-w-0 rounded-[28px] border border-sk-border bg-white p-2.5 shadow-sk-xs sm:p-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
        >
          <div className="relative overflow-hidden rounded-[22px] border border-[#f3e4b8] bg-[linear-gradient(180deg,#fffaf0_0%,#fff2cc_100%)]">
            <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <ScopeTabs scope={scope} onChange={setScope} />
                {isWeek && weeks.length > 0 && (
                  <label className="relative">
                    <span className="sr-only">Pilih minggu</span>
                    <select
                      value={week}
                      onChange={(event) => setWeek(event.target.value)}
                      className="h-9 cursor-pointer appearance-none rounded-full bg-white/85 pl-3.5 pr-8 text-[12.5px] font-semibold text-sk-navy shadow-sk-xs ring-1 ring-[#efdfb0] focus-visible:outline-2 focus-visible:outline-sk-blue"
                    >
                      <option value="">Minggu terbaru</option>
                      {weeks.map((item) => (
                        <option key={item.id} value={item.weekCode}>{item.weekCode}</option>
                      ))}
                    </select>
                    <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-sk-muted">▾</span>
                  </label>
                )}
              </div>
              <ViewerChip name={name} avatarId={user.avatarId} rank={chip.rank} value={chip.value} unit={chip.unit} />
            </div>

            <div className="relative px-4 pt-3 sm:px-5">
              <h2 id="leaderboard-heading" className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a6a07]">
                {heading}
              </h2>
              {stamp && <p className="mt-0.5 text-[11.5px] text-sk-muted">{stamp}</p>}
            </div>

            <ResourceState loading={false} error={isWeek ? (unpublished ? null : weekly.error) : allTime.error} retry={board.refresh} />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={contentKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                {board.loading && !board.data ? (
                  <div aria-busy="true" className="mx-auto flex h-[300px] max-w-[520px] items-end gap-4 px-6 pb-0">
                    {[134, 176, 108].map((h, i) => (
                      <span key={i} className="skeleton flex-1 rounded-t-[40%]" style={{ height: h }} />
                    ))}
                  </div>
                ) : empty || !view ? (
                  <EmptyBoard weekly={isWeek} />
                ) : (
                  <div className="px-2 pt-6 sm:px-6">
                    <Podium entries={view.podium} label="Tiga teratas" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {view && !empty && (
            <div className="mt-2 px-0.5">
              <RankingTable
                key={contentKey}
                rows={view.rows}
                caption={heading}
                highlightRank={highlightRank}
                headers={isWeek ? { detail: 'Divisi', value: 'Skor', extra: 'Poin' } : { detail: 'Terbaik', value: 'Total', extra: 'Minggu' }}
              />
            </div>
          )}
        </motion.section>

        <aside className="flex flex-col gap-6">
          <motion.section
            aria-label="Profil kamu"
            className="rounded-[28px] border border-sk-border bg-white p-5 text-center shadow-sk-xs"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: 0.12 }}
          >
            <div className="relative mx-auto w-fit">
              <span aria-hidden className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,214,92,0.45),transparent_70%)]" />
              <AvatarBadge avatarId={user.avatarId} seed={user.displayName ?? user.email} size="2xl" className="relative ring-4 ring-white shadow-sk-md" />
            </div>
            <p className="mt-3 text-[17px] font-extrabold tracking-[-0.02em] text-sk-navy">{name}</p>
            {user.email && <p className="mt-0.5 break-all text-[12.5px] text-sk-muted">{user.email}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-sk-border pt-4 text-left">
              <div className="rounded-[var(--radius-sk-lg)] bg-sk-bg px-3 py-2.5">
                <dt className="text-[11px] font-semibold text-sk-muted">{isWeek ? 'Posisi minggu ini' : 'Posisi total'}</dt>
                <dd className="mt-0.5 font-mono text-[18px] font-bold tabular-nums text-sk-navy">{chip.rank ? `#${chip.rank}` : '—'}</dd>
              </div>
              <div className="rounded-[var(--radius-sk-lg)] bg-sk-bg px-3 py-2.5">
                <dt className="text-[11px] font-semibold text-sk-muted">Total poin</dt>
                <dd className="mt-0.5 font-mono text-[18px] font-bold tabular-nums text-sk-navy">
                  {points.data ? points.data.lifetimeEarned.toLocaleString('id-ID') : '—'}
                </dd>
              </div>
            </dl>
            <Link href="/app/profile" className="mt-3 inline-flex h-10 items-center text-[12.5px] font-bold text-sk-blue hover:underline">
              Ganti avatar
            </Link>
          </motion.section>
          <ClimbGuide />
        </aside>
      </div>
    </div>
  );
}
