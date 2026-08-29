'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ScanLine, FolderKanban, FileBarChart, User } from 'lucide-react';
import { cn } from '@/lib/cn';

const items = [
  { href: '/app', label: 'Home', Icon: Home, exact: true },
  { href: '/app/scanner', label: 'Scanner', Icon: ScanLine },
  { href: '/app/project', label: 'Project', Icon: FolderKanban },
  { href: '/app/report', label: 'Report', Icon: FileBarChart },
  { href: '/app/profile', label: 'Profile', Icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-[var(--color-border)] safe-bottom"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname?.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-semibold transition-colors',
                  active ? 'text-[var(--color-brand-600)]' : 'text-[var(--color-ink-tertiary)]',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', active && 'scale-110 transition-transform')} strokeWidth={active ? 2.4 : 1.8} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
