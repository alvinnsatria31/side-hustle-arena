'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ScanLine,
  FolderKanban,
  FileBarChart,
  Briefcase,
  Gift,
  User,
  LogOut,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { cn } from '@/lib/cn';
import { useDemoAuth } from '@/features/auth/useDemoAuth';
import { mockUser } from '@/data/mock/user';

const items = [
  { href: '/app', label: 'Beranda', Icon: Home, exact: true },
  { href: '/app/scanner', label: 'CV Scanner', Icon: ScanLine },
  { href: '/app/project', label: 'Weekly Project', Icon: FolderKanban },
  { href: '/app/report', label: 'Career Report', Icon: FileBarChart },
  { href: '/app/portfolio', label: 'Portfolio', Icon: Briefcase },
  { href: '/app/rewards', label: 'Rewards', Icon: Gift },
  { href: '/app/profile', label: 'Profile', Icon: User },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { signOut } = useDemoAuth();

  return (
    <aside className="hidden lg:flex flex-col w-[244px] shrink-0 border-r border-[var(--color-border)] bg-white h-screen sticky top-0">
      <div className="px-5 h-16 flex items-center border-b border-[var(--color-border)]">
        <Link href="/app" className="flex items-center">
          <BrandLogo size="md" />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Primary">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, Icon, exact }) => {
            const active = exact ? pathname === href : pathname?.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 h-11 px-3 rounded-[var(--radius-sm)] text-[14px] font-medium transition-colors',
                    active
                      ? 'bg-[var(--color-brand-50)] text-[var(--color-brand-600)]'
                      : 'text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink-primary)]',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]">
          <div className="h-9 w-9 rounded-full bg-[var(--color-brand-500)] text-white text-[12px] font-bold flex items-center justify-center">
            {mockUser.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--color-ink-primary)] truncate">
              {mockUser.name}
            </p>
            <p className="text-[11px] text-[var(--color-ink-tertiary)] truncate">
              {mockUser.careerInterest}
            </p>
          </div>
          <button
            onClick={signOut}
            className="h-9 w-9 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-ink-tertiary)] hover:bg-white hover:text-[var(--color-ink-primary)]"
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
