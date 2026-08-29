'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BottomActionTrayProps {
  children: ReactNode;
  className?: string;
}

/**
 * A sticky bottom action tray shown on mobile. Hidden on desktop.
 * Used for project detail CTAs, workspace submit buttons, etc.
 */
export function BottomActionTray({ children, className }: BottomActionTrayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className={cn(
        'lg:hidden fixed bottom-16 left-0 right-0 z-30 glass border-t border-[var(--color-border)] px-4 pt-3 safe-bottom',
        'transition-transform',
        mounted ? 'translate-y-0' : 'translate-y-full',
        className,
      )}
    >
      {children}
    </div>
  );
}
