'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { bottomNavLinks, isNavActive } from '@/components/layout/nav-links';
import { cn } from '@/lib/cn';

/**
 * Mobile bottom navigation.
 *
 * The column count follows the number of tabs that survive the launch flags,
 * rather than being written into the markup. A fixed `grid-cols-3` beside a
 * list that can hold four or five is how tabs end up cut off when a flag is
 * switched on, with nothing failing loudly enough to notice.
 */
const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

export function MobileBottomNav() {
  const pathname = usePathname();
  const tabs = bottomNavLinks();
  if (tabs.length === 0) return null;

  return (
    <nav
      className="glass-nav safe-bottom fixed inset-x-0 bottom-0 z-40 rounded-b-none border-x-0 border-b-0 shadow-[0_-4px_20px_rgba(16,37,68,0.08)] md:hidden"
      style={{ background: 'rgba(255,255,255,0.95)' }}
      aria-label="Navigasi bawah"
    >
      <ul className={cn('grid px-1.5 pb-2 pt-2', COLS[tabs.length] ?? 'grid-cols-5')}>
        {tabs.map((tab) => {
          const active = isNavActive(tab.href, pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-[var(--radius-sk-md)] px-0.5 text-[9.5px] font-semibold transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2',
                  active ? 'text-sk-blue' : 'text-sk-muted hover:text-sk-navy',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid h-7 w-9 place-items-center rounded-full transition-colors',
                    active && 'bg-sk-blue-tint',
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="max-w-full truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
