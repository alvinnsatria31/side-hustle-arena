'use client';

import { useEffect, useRef, useState } from 'react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';

/**
 * A number that arrives rather than appears.
 *
 * The dashboard's four tiles are the only place a participant sees points move,
 * and a value that is simply painted reads as a label. Counting draws the eye
 * to the tile that changed. It runs once per value, never on every render, and
 * reduced motion gets the final number immediately. `decimals` keeps a score
 * like 91,5 exact at the end of the count instead of rounding it to 92.
 * `from` makes the first paint count up too (the podium passes 0); without it
 * only later changes animate.
 */
export function CountUp({
  value,
  duration = 800,
  decimals = 0,
  from: initial = value,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  from?: number;
}) {
  const reduce = useSettledReducedMotion();
  const [shown, setShown] = useState(initial);
  const from = useRef(initial);
  const factor = 10 ** decimals;

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduce || start === value) {
      setShown(value);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t < 1 ? Math.round((start + (value - start) * eased) * factor) / factor : value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduce, factor]);

  const format = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  // The animated value is decoration; assistive tech reads the real one once.
  return (
    <>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
