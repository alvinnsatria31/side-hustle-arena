'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Gauge, ShieldAlert, CalendarClock, ClipboardCheck, Users, Gift, RefreshCw } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import type { ArenaAdminScope } from '@/server/admin/auth';

const NAV: Array<{ href: string; label: string; Icon: typeof Gauge; scope: ArenaAdminScope | null }> = [
  { href: '/app/admin', label: 'Overview', Icon: Gauge, scope: null },
  { href: '/app/admin/flags', label: 'Saklar Darurat', Icon: ShieldAlert, scope: 'projects' },
  { href: '/app/admin/weeks', label: 'Minggu', Icon: CalendarClock, scope: 'weeks' },
  { href: '/app/admin/reviews', label: 'Review', Icon: ClipboardCheck, scope: 'reviews' },
  { href: '/app/admin/users', label: 'Peserta', Icon: Users, scope: 'users' },
  { href: '/app/admin/rewards', label: 'Reward', Icon: Gift, scope: 'rewards' },
];

/** `overview` scope gates the layout itself, so every admin sees every link they have a scope for. */
export function AdminNav({ scopes }: { scopes: ArenaAdminScope[] }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => item.scope === null || scopes.includes(item.scope));
  return (
    <nav aria-label="Navigasi admin" className="mb-7 flex flex-wrap gap-x-5 gap-y-3 border-b border-sk-border pb-4 text-sm">
      {items.map(({ href, label, Icon }) => {
        const active = href === '/app/admin' ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 py-1 font-semibold ${active ? 'text-sk-blue' : 'text-sk-muted hover:text-sk-blue'}`}
          >
            <Icon size={15} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-sk-navy">{title}</h1>
        {action}
      </div>
      {children}
    </div>
  );
}

export function AdminRefreshButton({ refresh, loading }: { refresh: () => void; loading: boolean }) {
  return (
    <Button variant="ghost" size="sm" disabled={loading} onClick={refresh} iconLeft={<RefreshCw size={15} aria-hidden />}>
      Perbarui
    </Button>
  );
}

/** Server Components (e.g. the overview page) have no client refresh loop of their own. */
export function AdminServerRefreshButton() {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={() => router.refresh()} iconLeft={<RefreshCw size={15} aria-hidden />}>
      Perbarui
    </Button>
  );
}
