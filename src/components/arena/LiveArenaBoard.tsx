import Link from 'next/link';
import { Clock3 } from 'lucide-react';
import { DeadlineCountdown } from '@/components/arena/DeadlineCountdown';

/** Same shape as `PublicWeekPoints`: the score's range plus the podium bonuses. */
export interface LiveArenaPoints {
  scoreMax: number;
  rank1: number;
  rank2: number;
  rank3: number;
}

/**
 * Hero status panel for the open week.
 *
 * It deliberately does NOT list the week's projects: the landing renders those
 * as full cards under #proyek, and showing both made the same three briefs
 * appear twice on one screen. What stays here is what a card cannot carry —
 * the live countdown, how many people already joined, and what the week pays.
 */
export function LiveArenaBoard({
  weekNo,
  deadline,
  deadlineAt,
  participantCount,
  points,
  canSelect = true,
  status,
  opensLabel,
}: {
  weekNo?: number;
  deadline?: string;
  deadlineAt?: string;
  participantCount: number;
  points?: LiveArenaPoints | null;
  /** False while the week is not taking picks: before it opens (PREVIEW) and
   *  after its deadline, through the weekend until the next drop. */
  canSelect?: boolean;
  status?: string;
  /** "Senin · 08.00" — when picking opens. */
  opensLabel?: string;
}) {
  const upcoming = status === 'PREVIEW' || status === 'SCHEDULED';
  return (
    <section
      aria-labelledby="live-arena-title"
      className="overflow-hidden rounded-[18px] bg-white shadow-[0_26px_58px_-30px_rgba(7,21,45,0.36)]"
    >
      <div className="flex items-center justify-between gap-4 bg-[#F7F8FF] px-4 py-4 sm:min-h-[58px] sm:px-[30px] sm:py-0">
        <Link
          id="live-arena-title"
          href="/arena/projects"
          className="text-[16px] font-extrabold tracking-[-0.02em] text-sk-navy transition-colors hover:text-sk-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-blue focus-visible:ring-offset-4 sm:text-[19px]"
        >
          PROYEK PEKAN INI
        </Link>
        <Link
          href="/arena/projects"
          className="shrink-0 rounded-md bg-[#E5E9F5] px-2.5 py-1.5 text-[11px] font-extrabold text-sk-navy transition-colors hover:bg-[#D9DFEF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-blue focus-visible:ring-offset-2 sm:text-[13px]"
        >
          {weekNo ? `MINGGU ${weekNo}` : 'ARENA'}
        </Link>
      </div>

      <div className="p-3.5 sm:px-[30px] sm:pb-6 sm:pt-6">
        {!deadline ? (
          <div className="rounded-xl border border-[#E2E6F4] bg-[#F1F3FE] px-5 py-9 text-center">
            <p className="font-bold text-sk-navy">Belum ada proyek yang dibuka</p>
            <Link href="/arena/projects" className="mt-2 inline-flex min-h-11 items-center font-semibold text-sk-blue hover:underline">
              Lihat daftar proyek
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-[#F3D5D2] bg-[#FDE8E6] px-4 py-3.5 text-[#9F101A]">
                <p className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em]">
                  <Clock3 size={14} strokeWidth={2.4} aria-hidden />
                  Sisa waktu pengumpulan
                </p>
                <p className="mt-1.5 text-[26px] font-extrabold leading-none tabular-nums sm:text-[30px]">
                  {deadlineAt ? <DeadlineCountdown deadlineAt={deadlineAt} /> : deadline}
                </p>
                <p className="mt-1.5 text-[12px] font-semibold text-[#B4443F]">Batas: {deadline}</p>
              </div>

              {points ? (
                <div className="rounded-xl border border-[#E3E7F4] bg-[#F0F2FD] px-4 py-3.5">
                  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#555D70]">Poin pekan ini</p>
                  <dl className="mt-2 space-y-1.5 text-[12.5px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[#555D70]">Skor akhir jadi poin</dt>
                      <dd className="font-extrabold tabular-nums text-sk-navy">0–{points.scoreMax}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[#555D70]">Bonus peringkat 1 · 2 · 3</dt>
                      <dd className="font-extrabold tabular-nums text-[#064CB2]">
                        +{points.rank1} · +{points.rank2} · +{points.rank3}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#E3E7F4] bg-[#F7F8FF] px-4 py-3.5">
                  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#555D70]">Poin pekan ini</p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[#727889]">Belum diumumkan untuk minggu ini.</p>
                </div>
              )}
            </div>

            <p className="mt-3 flex min-h-[40px] flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-[#E9ECF8] px-3.5 py-1.5 text-[11px] text-[#555D70] sm:text-[13px]">
              <span className="h-2 w-2 rounded-full bg-[#0874C9]" aria-hidden />
              <strong className="tabular-nums text-sk-navy">{participantCount} peserta</strong>
              {canSelect || upcoming ? 'sudah mengambil proyek pekan ini' : 'ikut sprint pekan ini'}
            </p>

            {canSelect ? (
              <Link
                href="#proyek"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md bg-sk-blue px-4 text-[13.5px] font-extrabold text-white shadow-sk-btn transition-colors hover:bg-sk-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-blue focus-visible:ring-offset-2"
              >
                Pilih proyek pekan ini
              </Link>
            ) : (
              // Not taking picks: "Pilih proyek pekan ini" sent people to a
              // catalog they could not pick from — before opening and all weekend.
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  href={upcoming ? '#proyek' : '/arena/showcase'}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-sk-navy px-4 text-[13.5px] font-extrabold text-white transition-colors hover:bg-sk-navy-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-blue focus-visible:ring-offset-2"
                >
                  {upcoming ? 'Baca brief pekan ini' : 'Lihat Sorotan Mingguan'}
                </Link>
                <p className="text-center text-[12px] font-semibold text-[#555D70] sm:max-w-[48%] sm:text-left">
                  {upcoming
                    ? `Pemilihan proyek dibuka ${opensLabel ? `${opensLabel} WIB` : 'segera'}.`
                    : 'Pengumpulan sudah ditutup. Brief baru biasanya dibuka Senin pukul 08.00 WIB.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
