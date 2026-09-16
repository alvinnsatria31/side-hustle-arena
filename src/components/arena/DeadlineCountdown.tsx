'use client';

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/countdown';

export function DeadlineCountdown({ deadlineAt }: { deadlineAt: string }) {
  const deadline = new Date(deadlineAt).getTime();
  const [remaining, setRemaining] = useState('—');

  useEffect(() => {
    const update = () => setRemaining(formatCountdown(deadline - Date.now()));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return <span aria-live="off">{remaining}</span>;
}
