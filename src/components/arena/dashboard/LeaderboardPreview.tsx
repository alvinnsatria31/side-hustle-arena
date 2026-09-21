'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, RefreshCw, Trophy } from 'lucide-react';
import { AvatarBadge } from '../AvatarBadge';
import { DivisionBadge } from '../leaderboard/DivisionBadge';
import { Podium } from '../leaderboard/Podium';
import { RankBadge } from '../leaderboard/RankBadge';
import { StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { ArenaApiError, getLeaderboard } from '@/lib/arena-client';
import { useParticipantResource, type ParticipantOverview } from '@/lib/participant-client';
import { myWeekRanking } from '@/lib/dashboard-view';

function Heading({ weekCode, final }: { weekCode?: string; final?: boolean }) {
  return (
    <div>
      <p className="flex items-center gap-1.5">
        <Trophy size={12} aria-hidden className="text-sk-gold" />
        <span className="eyebrow">Papan peringkat{weekCode ? ` · ${weekCode}` : ''}</span>
      </p>
      <div className="mt-2 flex items-center gap-2">
        <h2 id="leaderboard-preview-title" className="text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
          Peringkat minggu ini
        </h2>
        {final && (
          <span className="rounded-md bg-sk-success-tint px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-sk-success">
            Final
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Compact leaderboard spotlight for the Ringkasan dashboard.
 *
 * The same stage as the Peringkat page, smaller: the latest finalized week's
 * top three on the podium, the next few as rows, and a "Kamu" strip read from
 * overview history (leaderboard rows carry no user key, so the strip never
 * guesses which row is mine).
 */
export function LeaderboardPreview({ history }: { history: ParticipantOverview['history'] }) {
  const loader = useCallback(() => getLeaderboard(undefined), []);
  const board = useParticipantResource(loader);
  const unpublished =
    board.error instanceof ArenaApiError &&
    ['WEEK_NOT_FOUND', 'WEEK_NOT_FINALIZED'].includes(board.error.code);

  if (board.loading && !board.data) {
    return (
      <section aria-labelledby="leaderboard-preview-title" aria-busy="true" className="rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-6">
        <Heading />
        <div className="mx-auto mt-6 flex h-[180px] max-w-[420px] items-end gap-4">
          {[96, 124, 78].map((h, i) => (
            <span key={i} className="skeleton flex-1 rounded-t-[40%]" style={{ height: h }} />
          ))}
        </div>
      </section>
    );
  }

  if (board.error && !unpublished) {
    return (
      <section aria-labelledby="leaderboard-preview-title" className="rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-6">
        <Heading />
        <div role="alert" className="mt-5 flex flex-wrap items-center gap-4 rounded-[var(--radius-sk-xl)] border border-sk-error-border bg-sk-error-wash p-5">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-sk-error">Peringkat gagal dimuat.</p>
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
      <section aria-labelledby="leaderboard-preview-title" className="rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-6">
        <Heading />
        <div className="mt-5 rounded-[var(--radius-sk-xl)] bg-[#fffaf0] p-5">
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
  const podium = board.data.rows.slice(0, 3).map((row) => ({
    rank: row.rank,
    name: row.displayName,
    avatarId: row.avatarId,
    division: row.divisionName,
    value: row.finalScore,
    unit: 'SKOR',
  }));
  const context = board.data.rows.slice(3, 5);
  const me = myWeekRanking(history, weekCode);
  const gap = me ? board.data.rows[0].finalScore - me.finalScore : null;

  return (
    <section aria-labelledby="leaderboard-preview-title" className="rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-5 shadow-sk-xs sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <Heading weekCode={weekCode} final />
        <Link
          href="/app/arena/leaderboard"
          className="inline-flex h-11 items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
        >
          Lihat lengkap <ArrowRight size={15} aria-hidden />
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-[#f3e4b8] bg-[linear-gradient(180deg,#fffaf0_0%,#fff2cc_100%)] px-3 pt-5">
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative">
          <Podium entries={podium} size="md" label={`Tiga teratas ${weekCode}`} />
        </div>
      </div>

      <StaggerGroup className="mt-4 space-y-2">
        {context.map((row) => (
          <StaggerItem key={row.rank}>
            <div className="flex min-h-[52px] items-center gap-3 rounded-[var(--radius-sk-xl)] bg-[#fffaf0] px-3 py-2">
              <RankBadge rank={row.rank} className="h-7 w-7 text-[11.5px]" />
              <span className="relative shrink-0">
                <AvatarBadge avatarId={row.avatarId} seed={row.displayName} size="sm" />
                <DivisionBadge division={row.divisionName} size={14} className="absolute -bottom-0.5 -right-1" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-sk-navy">{row.displayName}</span>
                <span className="block truncate text-[11px] text-sk-muted">{row.projectTitle}</span>
              </span>
              <span className="shrink-0 font-mono text-[14px] font-bold tabular-nums text-sk-navy">{row.finalScore.toLocaleString('id-ID')}</span>
            </div>
          </StaggerItem>
        ))}
        <StaggerItem>
          <div
            className="relative flex min-h-[52px] items-center gap-3 overflow-hidden rounded-[var(--radius-sk-xl)] border border-sk-blue bg-sk-blue-tint px-3 py-2"
            aria-label={me ? `Peringkat kamu ${me.rank}` : 'Kamu belum masuk peringkat'}
          >
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
              initial={{ x: '-100%' }}
              whileInView={{ x: '100%' }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            />
            {me ? (
              <RankBadge rank={me.rank} className="relative h-7 w-7 text-[11.5px]" />
            ) : (
              <span className="relative grid h-7 w-7 place-items-center font-mono text-[13px] font-bold text-sk-blue-700">—</span>
            )}
            <span className="relative min-w-0 flex-1">
              <span className="block text-[13.5px] font-extrabold text-sk-navy">Kamu</span>
              <span className="block truncate text-[11.5px] text-sk-body">
                {me
                  ? gap !== null && gap > 0
                    ? `skor ${me.finalScore.toLocaleString('id-ID')} · selisih ${gap.toLocaleString('id-ID')} dari #1`
                    : `skor ${me.finalScore.toLocaleString('id-ID')} · kamu memimpin!`
                  : 'selesaikan satu sprint dulu'}
              </span>
            </span>
          </div>
        </StaggerItem>
      </StaggerGroup>
    </section>
  );
}
