'use client';

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/countdown';

interface Props {
  deadlineAt: string;
  deadlineLabel: string;
  projectCount: number;
  divisionCount: number;
  isOpen: boolean;
}

/**
 * The live week, in one line under the hero.
 *
 * This replaces the full-width sprint panel the hero used to carry. The panel
 * was the page's product shot, and it sat exactly where the project cards now
 * sit — the cards make the same claim with more evidence, so the status only
 * needs to be true, not large.
 *
 * The countdown stays on the client for the reason the old panel's did: a
 * deadline compared on the server is compared against the server's clock, and
 * a countdown belongs to whoever is watching it. Before the first tick it
 * renders the deadline label alone, which is true in every state, so server
 * and client agree on the first paint.
 */
export function SprintStatusStrip({ deadlineAt, deadlineLabel, projectCount, divisionCount, isOpen }: Props) {
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
    <dl className="mx-auto flex max-w-fit flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-full border border-sk-border bg-white/80 px-5 py-3 shadow-sk-xs backdrop-blur sm:gap-x-8 sm:px-7">
      <div className="flex items-center gap-2.5">
        <dt className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-sk-faint">
          {passed ? 'Pengumpulan' : 'Sisa waktu'}
        </dt>
        <dd className="font-mono text-[14px] font-bold tracking-[-0.02em] text-sk-navy tabular-nums">
          {passed ? 'Sudah ditutup' : remaining === null ? deadlineLabel : formatCountdown(remaining)}
        </dd>
      </div>

      <span aria-hidden className="hidden h-4 w-px bg-sk-border sm:block" />

      <div className="flex items-center gap-2.5">
        <dt className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-sk-faint">Proyek</dt>
        <dd className="font-mono text-[14px] font-bold tracking-[-0.02em] text-sk-navy tabular-nums">
          {projectCount}
        </dd>
      </div>

      <span aria-hidden className="hidden h-4 w-px bg-sk-border sm:block" />

      <div className="flex items-center gap-2.5">
        <dt className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-sk-faint">Divisi</dt>
        <dd className="font-mono text-[14px] font-bold tracking-[-0.02em] text-sk-navy tabular-nums">
          {divisionCount}
        </dd>
      </div>

      <span aria-hidden className="hidden h-4 w-px bg-sk-border sm:block" />

      <div className="flex items-center gap-2.5">
        <dt className="sr-only">Status pendaftaran</dt>
        <dd className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-sk-body">
          <span
            aria-hidden
            className={isOpen ? 'h-1.5 w-1.5 rounded-full bg-sk-success' : 'h-1.5 w-1.5 rounded-full bg-sk-faint'}
          />
          {isOpen ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup'}
        </dd>
      </div>
    </dl>
  );
}
