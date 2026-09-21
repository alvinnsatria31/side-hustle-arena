'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { ArrowRight, RefreshCw, Trophy } from 'lucide-react';
import { AvatarBadge } from '../AvatarBadge';
import { ArenaApiError, getLeaderboard } from '@/lib/arena-client';
import { useParticipantResource, type ParticipantOverview } from '@/lib/participant-client';
import { myWeekRanking } from '@/lib/dashboard-view';

/**
 * Compact leaderboard spotlight for the Ringkasan dashboard.
 *
 * Shows the top 3 of the latest finalized week plus a "Kamu" strip read from
 * overview history (leaderboard rows carry no user key, so the strip never
 * guesses which row is mine). Placed after StatStrip: Hero → Stat →
 * Leaderboard → Explore.
 */
export function LeaderboardPreview({ history }: { history: ParticipantOverview['history'] }) {
  const loader = useCallback(() => getLeaderboard(undefined), []);
  const board = useParticipantResource(loader);
  const unpublished =
    board.error instanceof ArenaApiError &&
    ['WEEK_NOT_FOUND', 'WEEK_NOT_FINALIZED'].includes(board.error.code);

  if (board.loading && !board.data) {
    return (
      <section aria-labelledby="leaderboard-preview-title" className="mt-10" aria-busy="true">
        <p className="eyebrow">Papan peringkat</p>
        <h2 id="leaderboard-preview-title" className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
          Peringkat minggu ini
        </h2>
        <ul className="mt-5 space-y-3" aria-label="Memuat peringkat">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-4">
              <span className="h-5 w-8 animate-pulse rounded bg-sk-bg" />
              <span className="h-9 w-9 animate-pulse rounded-full bg-sk-bg" />
              <span className="h-4 flex-1 animate-pulse rounded bg-sk-bg" />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (board.error && !unpublished) {
    return (
      <section aria-labelledby="leaderboard-preview-title" className="mt-10">
        <p className="eyebrow">Papan peringkat</p>
        <h2 id="leaderboard-preview-title" className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
          Peringkat minggu ini
        </h2>
        <div role="alert" className="mt-5 flex flex-wrap items-center gap-4 rounded-[var(--radius-sk-xl)] border border-sk-error-border bg-sk-error-wash p-5">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-sk-error">
            Peringkat gagal dimuat.
          </p>
          <button
            onClick={() => void board.refresh()}
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold text-sk-error"
          >
            <RefreshCw size={14} aria-hidden /> Coba lagi
          </button>
        </div>
      </section>
    );
  }

  if (unpublished || !board.data || board.data.rows.length === 0) {
    return (
      <section aria-labelledby="leaderboard-preview-title" className="mt-10">
        <p className="eyebrow">Papan peringkat</p>
        <h2 id="leaderboard-preview-title" className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
          Peringkat minggu ini
        </h2>
        <div className="mt-5 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-sk-navy">
            <Trophy size={15} aria-hidden /> Peringkat minggu ini belum diumumkan.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-sk-muted">
            Fokus selesaikan kirimanmu dulu — begitu final, posisimu muncul di sini.
          </p>
          <Link
            href="/app/arena/leaderboard"
            className="mt-3 inline-flex h-11 items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
          >
            Lihat halaman peringkat <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  const weekCode = board.data.weekCode;
  const top = board.data.rows.slice(0, 3);
  const me = myWeekRanking(history, weekCode);
  const gap = me ? board.data.rows[0].finalScore - me.finalScore : null;

  return (
    <section aria-labelledby="leaderboard-preview-title" className="mt-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Papan peringkat · {weekCode}</p>
          <h2 id="leaderboard-preview-title" className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
            Peringkat minggu ini
          </h2>
        </div>
        <Link
          href="/app/arena/leaderboard"
          className="inline-flex h-11 items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
        >
          Lihat lengkap <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      <ol className="space-y-3">
        {top.map((row) => (
          <li
            key={row.rank}
            className="flex min-h-[56px] items-center gap-3 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white px-4 py-3"
          >
            <span className="w-8 shrink-0 font-mono text-[15px] font-bold tabular-nums text-sk-navy">
              #{row.rank}
            </span>
            <AvatarBadge avatarId={row.avatarId} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold text-sk-navy">
                {row.displayName}
              </span>
              <span className="block truncate text-[11.5px] text-sk-muted">{row.projectTitle}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-[15px] font-bold tabular-nums text-sk-navy">
                {row.finalScore}
              </span>
              <span className="block font-mono text-[11px] font-semibold tabular-nums text-sk-success">
                +{row.pointsAwarded}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <div
        className="mt-3 flex min-h-[56px] items-center gap-3 rounded-[var(--radius-sk-xl)] border border-sk-blue/30 bg-sk-blue-tint px-4 py-3"
        aria-label={me ? `Peringkat kamu ${me.rank}` : 'Kamu belum masuk peringkat'}
      >
        <span className="w-8 shrink-0 font-mono text-[15px] font-bold tabular-nums text-sk-blue-700">
          {me ? `#${me.rank}` : '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-sk-navy">Kamu</span>
          <span className="block truncate text-[11.5px] text-sk-muted">
            {me
              ? gap !== null && gap > 0
                ? `skor ${me.finalScore} · selisih ${gap} dari #1`
                : `skor ${me.finalScore} · kamu memimpin!`
              : 'selesaikan satu sprint dulu'}
          </span>
        </span>
      </div>
    </section>
  );
}
