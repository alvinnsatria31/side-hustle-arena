'use client';

import { useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';

interface CountUpProps {
  to: number;
  duration?: number;
  className?: string;
  /** Rendered after the number, e.g. "/100" or "%" */
  suffix?: string;
  prefix?: string;
}

/** Animates 0 → target over ~900ms ease-out when scrolled into view. */
export function CountUp({ to, duration = 0.9, className, suffix, prefix }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-24px' });
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    if (reduce) {
      node.textContent = `${prefix ?? ''}${to}${suffix ?? ''}`;
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => {
        node.textContent = `${prefix ?? ''}${Math.round(v)}${suffix ?? ''}`;
      },
    });
    return () => controls.stop();
  }, [inView, to, duration, reduce, prefix, suffix]);

  return (
    <span ref={ref} className={className} aria-label={String(to)}>
      {`${prefix ?? ''}0${suffix ?? ''}`}
    </span>
  );
}
