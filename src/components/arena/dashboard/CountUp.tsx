'use client';

import { useEffect, useRef, useState } from 'react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';

/**
 * A number that arrives rather than appears.
 *
 * The dashboard's four tiles are the only place a participant sees points move,
 * and a value that is simply painted reads as a label. Counting draws the eye
 * to the tile that changed. It runs once per value, never on every render, and
 * reduced motion gets the final number immediately.
 */
export function CountUp({ value, duration = 800 }: { value: number; duration?: number }) {
  const reduce = useSettledReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

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
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduce]);

  // The animated value is decoration; assistive tech reads the real one once.
  return (
    <>
      <span aria-hidden>{shown.toLocaleString('id-ID')}</span>
      <span className="sr-only">{value.toLocaleString('id-ID')}</span>
    </>
  );
}
