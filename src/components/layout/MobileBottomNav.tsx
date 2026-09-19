'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, UserRound, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS = [
  { label: 'Beranda', href: '/app', icon: Home },
  { label: 'Arena', href: '/app/arena', icon: Zap },
  { label: 'Profil', href: '/app/profile', icon: UserRound },
];

/** Mobile bottom navigation — 44px+ touch targets. */
export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="glass-nav fixed inset-x-0 bottom-0 z-40 rounded-b-none border-x-0 border-b-0 safe-bottom md:hidden"
      style={{ background: 'rgba(255,255,255,0.95)' }}
      aria-label="Navigasi bawah"
    >
      <ul className="grid grid-cols-3 px-2 pb-2 pt-2.5">
        {TABS.map((tab) => {
          const active = tab.href === '/app' ? pathname === '/app' : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg text-[9.5px] font-semibold transition-colors',
                  active ? 'text-sk-blue' : 'text-sk-muted hover:text-sk-navy',
                )}
              >
                <Icon size={20} aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
