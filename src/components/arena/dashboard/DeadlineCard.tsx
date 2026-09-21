'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { sprintRemainingParts } from '@/lib/dashboard-view';

/** One countdown block; the digit transitions like a subtle digital clock. */
function Block({ value, unit }: { value: number; unit: string }) {
  const reduce = useSettledReducedMotion();
  const padded = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-1 rounded-[var(--radius-sk-md)] bg-white py-3">
      <div className="relative h-9 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={padded}
            className="block font-mono text-[30px] font-bold leading-9 tracking-[-0.02em] text-sk-navy tabular-nums"
            initial={reduce ? false : { y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: -10, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {padded}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-[11.5px] text-sk-muted">{unit}</span>
    </div>
  );
}

export function DeadlineCard({
  deadlineAt,
  href,
  dateLabel,
  progress,
}: {
  deadlineAt: string;
  href: string;
  dateLabel: (value: string) => string;
  /** Real work progress (from the mission's current step), 0–100. */
  progress: number | null;
}) {
  const [parts, setParts] = useState(() => sprintRemainingParts(deadlineAt));

  useEffect(() => {
    const update = () => setParts(sprintRemainingParts(deadlineAt));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);

  return (
    <motion.section
      aria-labelledby="deadline-title"
      className="rounded-[var(--radius-sk-2xl)] border border-sk-border p-5"
      style={{ background: 'var(--color-sk-deadline-tint)' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          id="deadline-title"
          className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-sk-warning-ink"
        >
          <CalendarClock size={13} aria-hidden />
          Batas pengumpulan
        </p>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[12px] font-bold text-sk-blue hover:underline"
        >
          Detail <ArrowRight size={12} aria-hidden />
        </Link>
      </div>

      {parts.over ? (
        <p className="mt-4 text-[15px] font-bold text-sk-error">Waktu pengumpulan sudah habis.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Block value={parts.days} unit="hari" />
            <Block value={parts.hours} unit="jam" />
            <Block value={parts.minutes} unit="menit" />
          </div>

          {progress !== null && (
            <div className="mt-4">
              <div className="h-[3px] overflow-hidden rounded-full bg-white/70">
                <motion.div
                  className="h-full rounded-full bg-sk-warning"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-sk-muted">Progres pengerjaan {progress}%</p>
            </div>
          )}
          <p className="mt-2 text-[12px] leading-relaxed text-sk-body">{dateLabel(deadlineAt)} WIB</p>
        </>
      )}
    </motion.section>
  );
}
