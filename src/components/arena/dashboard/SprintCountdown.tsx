'use client';

import { useEffect, useState } from 'react';
import { sprintRemaining, type DeadlineTone } from '@/lib/dashboard-view';

/**
 * The live "time left" on the current sprint.
 *
 * Rendered from the server it would be wrong within a minute, so the first
 * paint shows the server-safe reading and the ticker takes over on mount. It
 * re-reads once a minute: this counts days, and a per-second interval would
 * wake the tab 1,440 times to change nothing.
 */
export function SprintCountdown({
  deadlineAt,
  children,
}: {
  deadlineAt: string;
  children: (state: { text: string; tone: DeadlineTone }) => React.ReactNode;
}) {
  const [state, setState] = useState(() => sprintRemaining(deadlineAt));

  useEffect(() => {
    const update = () => setState(sprintRemaining(deadlineAt));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);

  return <>{children(state)}</>;
}
