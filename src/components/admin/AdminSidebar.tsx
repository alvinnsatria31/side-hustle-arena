'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarClock,
  ClipboardCheck,
  FolderKanban,
  Gauge,
  Gift,
  Layers,
  ListChecks,
  LogOut,
  Mail,
  Rocket,
  Briefcase,
  ShieldAlert,
  SquareArrowOutUpRight,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { cn } from '@/lib/cn';
import type { ArenaAdminScope } from '@/server/admin/auth';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** `null` shows for every admin: the layout gate already required a scope. */
  scope: ArenaAdminScope | null;
}

const GROUPS: Array<{ label: string | null; items: NavItem[] }> = [
  { label: null, items: [{ label: 'Overview', href: '/app/admin', icon: Gauge, scope: null }] },
  {
    label: 'Konten',
    items: [
      { label: 'Project', href: '/app/admin/projects', icon: FolderKanban, scope: 'projects' },
      { label: 'Divisi', href: '/app/admin/divisions', icon: Layers, scope: 'projects' },
      { label: 'Minggu', href: '/app/admin/weeks', icon: CalendarClock, scope: 'weeks' },
    ],
  },
  {
    label: 'Operasi',
    items: [
      // Rocket, not Workflow: this sits directly above Otomasi, and two
      // adjacent entries wearing the same icon are the two an operator most
      // needs to tell apart. It also matches the button on the page it opens.
      { label: 'Trigger Workflow', href: '/app/admin/workflows', icon: Rocket, scope: 'projects' },
      { label: 'Otomasi', href: '/app/admin/jobs', icon: Workflow, scope: 'overview' },
      { label: 'Review', href: '/app/admin/reviews', icon: ClipboardCheck, scope: 'reviews' },
      { label: 'Email', href: '/app/admin/email', icon: Mail, scope: 'notifications' },
      { label: 'Sumber Lowongan', href: '/app/admin/careers', icon: Briefcase, scope: 'careers' },
      { label: 'Audit Log', href: '/app/admin/audit', icon: ListChecks, scope: 'overview' },
    ],
  },
  {
    label: 'Orang & Reward',
    items: [
      { label: 'Peserta', href: '/app/admin/users', icon: Users, scope: 'users' },
      { label: 'Reward', href: '/app/admin/rewards', icon: Gift, scope: 'rewards' },
    ],
  },
  { label: 'Sistem', items: [{ label: 'Saklar Darurat', href: '/app/admin/flags', icon: ShieldAlert, scope: 'projects' }] },
];

/**
 * The admin rail.
 *
 * A Client Component for one reason: `usePathname`. Marking the active item is
 * navigation's job — without it, two clicks in you have only the page heading
 * to tell you where you are.
 *
 * The rail is light rather than navy on purpose: a dark sidebar pulls the eye
 * to the menu, and the menu is the least-read thing on an operations screen.
 */
export function AdminSidebar({ subject, scopes }: { subject: string; scopes: ArenaAdminScope[] }) {
  const pathname = usePathname();
  const visible = GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => item.scope === null || scopes.includes(item.scope)) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      aria-label="Navigasi admin"
      className="flex w-full shrink-0 flex-col border-b border-sk-border bg-white md:h-screen md:w-60 md:border-b-0 md:border-r lg:w-64 md:sticky md:top-0"
    >
      <div className="flex items-center gap-2.5 border-b border-sk-border px-5 py-4">
        <BrandLogo />
        <span className="rounded-full bg-sk-blue-tint px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-sk-blue">
          Admin
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visible.map((group) => (
          <div key={group.label ?? 'root'} className="mb-5 last:mb-0">
            {group.label && (
              <p className="mb-1.5 px-2.5 text-[10.5px] font-bold uppercase tracking-wider text-sk-muted">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = href === '/app/admin' ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[var(--radius-sk)] px-2.5 py-2 text-[13px] font-medium transition-colors',
                        active ? 'bg-sk-blue-tint font-bold text-sk-blue' : 'text-sk-body hover:bg-sk-bg hover:text-sk-navy',
                      )}
                    >
                      <Icon size={16} aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sk-border px-3 py-3">
        <p className="truncate px-2.5 pb-2 font-mono text-[10.5px] text-sk-muted" title={subject}>
          {subject}
        </p>
        <Link
          href="/app"
          className="flex items-center gap-2.5 rounded-[var(--radius-sk)] px-2.5 py-2 text-[13px] font-medium text-sk-body transition-colors hover:bg-sk-bg hover:text-sk-navy"
        >
          <SquareArrowOutUpRight size={16} aria-hidden />
          Kembali ke Arena
        </Link>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-[var(--radius-sk)] px-2.5 py-2 text-left text-[13px] font-medium text-sk-error transition-colors hover:bg-sk-error-wash"
          >
            <LogOut size={16} aria-hidden />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
