'use client';

import { motion } from 'motion/react';
import { Gift, MinusCircle, Plus, RotateCcw, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import type { PointActivity } from '@/lib/participant-client';
import { formatPoints } from '@/lib/reward-progress';
import { cn } from '@/lib/cn';

const KIND: Record<PointActivity['kind'], { icon: LucideIcon; tile: string; amount: string }> = {
  EARNED: { icon: Plus, tile: 'bg-sk-success-tint text-sk-success', amount: 'text-sk-success' },
  SPENT: { icon: Gift, tile: 'bg-sk-violet-tint text-sk-violet', amount: 'text-sk-error' },
  RETURNED: { icon: RotateCcw, tile: 'bg-sk-warning-tint text-sk-warning-ink', amount: 'text-sk-success' },
  REVOKED: { icon: MinusCircle, tile: 'bg-sk-error-tint text-sk-error', amount: 'text-sk-error' },
  ADJUSTED: { icon: SlidersHorizontal, tile: 'bg-sk-track text-sk-muted', amount: 'text-sk-navy' },
};

const when = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

/** Aktivitas poin terbaru: the last few movements of the wallet, newest first. */
export function PointActivityList({ items }: { items: PointActivity[] }) {
  const reduce = useSettledReducedMotion();
  if (!items.length) {
    return (
      <p className="rounded-[var(--radius-sk-2xl)] border border-dashed border-sk-border bg-white px-5 py-6 text-center text-[13px] text-sk-muted">
        Belum ada aktivitas poin. Poin pertamamu masuk begitu satu proyek selesai dinilai.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const kind = KIND[item.kind];
        const Icon = kind.icon;
        return (
          <motion.li
            key={item.id}
            className="card-rise flex items-start gap-3 rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-4"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, ease: 'easeOut', delay: index * 0.05 }}
          >
            <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', kind.tile)}>
              <Icon size={17} strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11.5px] font-semibold text-sk-muted">{item.label}</span>
              {item.subject && <span className="block truncate text-[13px] font-bold text-sk-navy">{item.subject}</span>}
              <span className={cn('mt-1 block font-mono text-[14px] font-bold tabular-nums', kind.amount)}>
                {item.amount > 0 ? '+' : '−'} {formatPoints(Math.abs(item.amount))} poin
              </span>
              <span className="mt-0.5 block text-[11px] text-sk-faint">{when.format(new Date(item.createdAt))} WIB</span>
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
