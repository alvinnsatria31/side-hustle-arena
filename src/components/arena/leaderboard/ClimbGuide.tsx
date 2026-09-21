'use client';

import { motion } from 'motion/react';
import { Compass, Gift, PenLine, Trophy, type LucideIcon } from 'lucide-react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';

const STEPS: Array<{ title: string; body: string; icon: LucideIcon; tint: string; ink: string }> = [
  {
    title: 'Pilih proyek',
    body: 'Brief baru dibuka tiap minggu. Ambil yang paling dekat dengan arah kariermu.',
    icon: Compass,
    tint: 'linear-gradient(145deg,#e0edff,#c7dcff)',
    ink: '#1a56d6',
  },
  {
    title: 'Kerjakan & kirim',
    body: 'Selesaikan tahap brief sampai kiriman final sebelum tenggat.',
    icon: PenLine,
    tint: 'linear-gradient(145deg,#ede7ff,#dccfff)',
    ink: '#5b3fd0',
  },
  {
    title: 'Dinilai rubrik',
    body: 'Kirimanmu dinilai per kriteria. Skor tertinggi minggu itu naik ke podium.',
    icon: Trophy,
    tint: 'linear-gradient(145deg,#fff3cf,#ffe39a)',
    ink: '#b26a00',
  },
  {
    title: 'Kumpulkan poin',
    body: 'Setiap kiriman yang dinilai dapat poin, juara dapat paling banyak. Tukar di Poin & hadiah.',
    icon: Gift,
    tint: 'linear-gradient(145deg,#dcf7e7,#bdeed2)',
    ink: '#0f7a44',
  },
];

/** "Cara naik peringkat": the four moves that put a name on this board. */
export function ClimbGuide() {
  const reduce = useSettledReducedMotion();
  return (
    <section aria-labelledby="climb-guide-title" className="rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-5">
      <h2 id="climb-guide-title" className="text-[15px] font-extrabold tracking-[-0.02em] text-sk-navy">
        Cara naik peringkat
      </h2>
      <ol className="relative mt-4 space-y-3">
        <span aria-hidden className="absolute bottom-8 left-[27px] top-8 border-l-2 border-dashed border-sk-border" />
        {STEPS.map((step, index) => (
          <motion.li
            key={step.title}
            className="relative flex items-start gap-3.5 rounded-[var(--radius-sk-xl)] bg-sk-bg p-3 transition-colors duration-200 hover:bg-sk-blue-wash"
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut', delay: 0.5 + index * 0.08 }}
          >
            <span
              aria-hidden
              style={{ background: step.tint, color: step.ink }}
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-[inset_0_-3px_6px_rgba(0,0,0,0.06),0_6px_14px_-8px_rgba(7,21,45,0.35)] ring-4 ring-white"
            >
              <step.icon size={19} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-[13px] font-bold text-sk-navy">{step.title}</span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-sk-muted">{step.body}</span>
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
