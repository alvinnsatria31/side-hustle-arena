'use client';

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/countdown';

interface Props {
  deadlineAt: string;
  /** Human deadline for the line under the clock, e.g. "Jumat · 23.59". */
  deadlineLabel: string;
  /** Whether the week still accepts project selection. */
  isOpen: boolean;
}

/**
 * The hero's deadline block, in the two states it actually has.
 *
 * The comparison lives on the client on purpose. Choosing a project and
 * submitting work close at different moments, so a week can be open for
 * enrolment with its submission window already past — and counting down to a
 * deadline that has gone renders "Selesai" in 46px type beside a "BUKA" badge,
 * which reads as a broken page rather than as the two different dates it is.
 * Deciding that on the server would also compare the server's clock against a
 * deadline the viewer reads in their own, and a countdown belongs to whoever
 * is watching it.
 *
 * Before the first tick the block renders the deadline label alone: that is
 * true in both states, so the server and the client agree on the first paint
 * and nothing flashes.
 */
export function SprintCountdownPanel({ deadlineAt, deadlineLabel, isOpen }: Props) {
  const deadline = new Date(deadlineAt).getTime();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setRemaining(deadline - Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  const passed = remaining !== null && remaining <= 0;

  return (
    <div className="rounded-[var(--radius-sk-xl)] border border-sk-border bg-sk-bg p-5">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-sk-faint">
        {passed ? 'Batas pengumpulan' : 'Sisa waktu pengumpulan'}
      </span>

      {passed ? (
        <>
          <p className="mt-2.5 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-sk-navy">
            Sudah lewat
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-sk-muted">
            {isOpen
              ? 'Pemilihan proyek masih terbuka untuk minggu berikutnya.'
              : 'Minggu ini sedang dinilai.'}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2.5 font-mono text-[38px] font-bold leading-none tracking-[-0.035em] text-sk-navy md:text-[46px]">
            {remaining === null ? '—' : formatCountdown(remaining)}
          </p>
          <p className="mt-3 text-[13px] text-sk-muted">Ditutup {deadlineLabel}</p>
        </>
      )}
    </div>
  );
}
