'use client';

import { motion } from 'motion/react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
  barClassName?: string;
  /** Animate from 0 when scrolled into view (default true). */
  animate?: boolean;
  delay?: number;
}

export function ProgressBar({ value, className, barClassName, animate = true, delay = 0 }: ProgressBarProps) {
  const reduce = useSettledReducedMotion();
  const width = `${Math.min(100, Math.max(0, value))}%`;
  return (
    <div
      className={cn('h-1.5 overflow-hidden rounded-full bg-sk-track', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {animate && !reduce ? (
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r from-sk-blue to-sk-blue-400', barClassName)}
          initial={{ width: 0 }}
          whileInView={{ width }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: 'easeOut', delay }}
        />
      ) : (
        <div
          className={cn('h-full rounded-full bg-gradient-to-r from-sk-blue to-sk-blue-400', barClassName)}
          style={{ width }}
        />
      )}
    </div>
  );
}
