'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { cn } from '@/lib/cn';

interface ScoreRingProps {
  value: number; // 0–100
  size?: number;
  strokeWidth?: number;
  label?: string;
  gradient?: [string, string];
  className?: string;
}

/** Progress ring with animated dashoffset (analyzing screen, career progress donut). */
export function ScoreRing({
  value,
  size = 300,
  strokeWidth = 14,
  label,
  gradient = ['#246BFD', '#5AE0A0'],
  className,
}: ScoreRingProps) {
  const reduce = useSettledReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  const gid = `ring-${gradient[0].replace('#', '')}-${gradient[1].replace('#', '')}`;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (reduce) {
      setDisplayValue(value);
      return;
    }
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-sk-track)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gid})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={reduce ? { strokeDashoffset: target } : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: target }}
          transition={{ duration: reduce ? 0 : 1.4, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={gradient[0]} />
            <stop offset="1" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[64px] font-extrabold leading-none tracking-[-0.03em] text-sk-navy">
          {displayValue}
          <span className="text-[28px] text-sk-muted">%</span>
        </span>
        {label && (
          <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-sk-muted">{label}</span>
        )}
      </div>
    </div>
  );
}
