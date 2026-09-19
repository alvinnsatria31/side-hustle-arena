'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';

/**
 * The hero panel's scroll-linked tilt.
 *
 * Taken from the live Saasto site, where the hero screenshot ships with
 * `transform: perspective(1200px) scale(0.8) rotateX(24deg)` and `opacity: 0.5`
 * inline, then straightens as the page scrolls. It is not part of that site's
 * appear animation — all 58 of those entries have `rotateX: 0` — which is why
 * it reads as a separate "flip" rather than as the fade-up everything else does.
 *
 * Under reduced motion the panel renders flat and fully opaque: the effect is
 * decorative, and tying content legibility to scroll position would make the
 * page worse for the people who asked for less movement.
 */
export function HeroTiltPanel({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useSettledReducedMotion();

  // Starts tilted while the panel is still low in the viewport and is flat by
  // the time its top third has arrived, so the straightening happens while the
  // panel is being read rather than after it has already settled.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.98', 'start 0.42'],
  });

  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.5, 1]);

  if (reduce) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      <motion.div
        style={{
          rotateX,
          scale,
          opacity,
          transformPerspective: 1200,
          transformOrigin: 'center top',
          willChange: 'transform',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
