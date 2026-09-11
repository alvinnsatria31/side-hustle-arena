'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
}

/**
 * Runs before the browser paints on the client, and is a no-op on the server.
 *
 * `useLayoutEffect` warns during SSR, `useEffect` runs after the first paint.
 * Reduced-motion users need the correction applied before that paint, or they
 * see one frame of the hidden state — which is the thing they asked not to have.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Reduced-motion preference that server and client agree on for one render.
 *
 * `useReducedMotion()` reads the media query the instant the module loads in the
 * browser, but there is no media query during SSR, so it answers `false` on the
 * server and `true` on the first client render for anyone who has reduced motion
 * on. Those components rendered different markup on each side: the server wrote
 * `opacity: 0` and a transform, the client wrote neither, and React reported a
 * hydration mismatch for exactly those attributes. React does not repair style
 * attributes on a mismatch, so the elements could stay at `opacity: 0` — content
 * invisible, for the users least able to work around it.
 *
 * This reports `false` (animate) for the first render on both sides, so the two
 * agree, and switches to the real preference in a layout effect — before the
 * first paint, so a reduced-motion visitor never sees the animated-from state.
 */
export function useSettledReducedMotion(): boolean {
  const prefersReduced = useReducedMotion();
  const [settled, setSettled] = useState(false);
  useIsomorphicLayoutEffect(() => {
    setSettled(true);
  }, []);
  return settled && Boolean(prefersReduced);
}

/**
 * Motion props that resolve to "already there" under reduced motion.
 *
 * The element type never changes between the two states — swapping `div` for
 * `motion.div` would remount the subtree and reset any state inside it — so the
 * preference is expressed as a zero-duration transition instead.
 */
function settleTransition(reduce: boolean, transition: Record<string, unknown>) {
  return reduce ? { duration: 0 } : transition;
}

/** Viewport-triggered entrance: opacity 0→1, y 12→0, 500ms ease-out. */
export function Reveal({ children, className, delay = 0, y = 12, once = true }: RevealProps) {
  const reduce = useSettledReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-48px', amount: reduce ? 0 : 'some' }}
      transition={settleTransition(reduce, { duration: 0.5, ease: 'easeOut', delay })}
    >
      {children}
    </motion.div>
  );
}

/** Mount-time entrance (hero content, page headers). */
export function Entrance({ children, className, delay = 0, y = 12 }: RevealProps) {
  const reduce = useSettledReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={settleTransition(reduce, { duration: 0.5, ease: 'easeOut', delay })}
    >
      {children}
    </motion.div>
  );
}

const groupVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

/** Staggered reveal container (60ms per item, approved motion token). */
export function StaggerGroup({
  children,
  className,
  animate = 'whileInView',
}: {
  children: ReactNode;
  className?: string;
  animate?: 'whileInView' | 'mount';
}) {
  const reduce = useSettledReducedMotion();
  return (
    <motion.div
      className={className}
      variants={groupVariants}
      initial="hidden"
      transition={reduce ? { duration: 0, staggerChildren: 0 } : undefined}
      {...(animate === 'whileInView'
        ? { whileInView: 'show' as const, viewport: { once: true, margin: '-48px', amount: reduce ? 0 : ('some' as const) } }
        : { animate: 'show' as const })}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useSettledReducedMotion();
  return (
    <motion.div className={className} variants={itemVariants} transition={reduce ? { duration: 0 } : undefined}>
      {children}
    </motion.div>
  );
}
