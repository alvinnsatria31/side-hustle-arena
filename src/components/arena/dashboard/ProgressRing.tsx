'use client';

import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { cn } from '@/lib/cn';

/**
 * Compact progress ring for the sprint hero.
 *
 * The hero used to draw this with a `conic-gradient` and a hardcoded track
 * colour, which gave a hard-edged wedge, no way to round the cap, and a `div`
 * with an `aria-label` that screen readers announce as plain text. An SVG arc
 * with `role="progressbar"` is the same picture and an actual progress control.
 */
export function ProgressRing({
  value,
  size = 96,
  stroke = 7,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  className?: string;
}) {
  const reduce = useSettledReducedMotion();
  const safe = Math.min(100, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#sprint-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safe / 100)}
          style={{
            transition: reduce ? 'none' : 'stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)',
          }}
        />
        <defs>
          <linearGradient id="sprint-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="var(--color-sk-mint)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-baseline justify-center gap-px pt-[0.45em] font-mono text-[19px] font-bold tracking-[-0.03em]">
        {Math.round(safe)}
        <span aria-hidden className="text-[11px] text-sk-on-navy-body">
          %
        </span>
        <span className="sr-only"> persen</span>
      </span>
    </div>
  );
}
