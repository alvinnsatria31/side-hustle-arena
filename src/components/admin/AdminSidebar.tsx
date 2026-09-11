'use client';

import Link from 'next/link';
import { LogoutForm } from '@/components/auth/LogoutForm';
import { usePathname } from 'next/navigation';
import {
  CalendarClock,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Gauge,
  Gift,
  Layers,
  ListChecks,
  LogOut,
  Mail,
  ScanLine,
  Briefcase,
  ShieldAlert,
  SquareArrowOutUpRight,
  Trophy,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { cn } from '@/lib/cn';
import type { ArenaAdminScope } from '@/server/admin/auth';
import type { NavBadge } from '@/server/ops/automation-health';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** `null` shows for every admin: the layout gate already required a scope. */
  scope: ArenaAdminScope | null;
}

/** A product with enough pages to need its own internal order. */
interface NavNest {
  label: string;
  icon: LucideIcon;
  sections: Array<{ label: string; items: NavItem[] }>;
}

type Entry = { kind: 'item'; item: NavItem } | { kind: 'nest'; nest: NavNest };

const item = (label: string, href: string, icon: LucideIcon, scope: ArenaAdminScope | null): Entry =>
  ({ kind: 'item', item: { label, href, icon, scope } });

/**
 * The rail is grouped by what an operator manages, not by kind of work.
 *
 * The old grouping ("Konten", "Operasi") named categories nobody searches for:
 * finding the jobs pipeline meant knowing it was called "Sumber Lowongan" and
 * lived under "Operasi". Products are what people actually go looking for, so
 * the subdomain's four products lead — and everything that genuinely crosses
 * all four (users, notifications, kill switches, the audit trail) is grouped
 * apart rather than parked inside whichever product it resembles most.
 *
 * Arena is nested because it alone has a lifecycle: eleven pages that are only
 * comprehensible in the order the week runs. The other products are single
 * entries, so nesting them would be ceremony with nothing inside.
 */
const GROUPS: Array<{ label: string | null; entries: Entry[] }> = [
  { label: null, entries: [item('Overview', '/app/admin', Gauge, null)] },
  {
    label: 'Produk',
    entries: [
      item('CV Scanner', '/app/admin/cv-scanner', ScanLine, 'overview'),
      // `users`: the page lists participants' emails and CV status.
      item('Career Report', '/app/admin/career-report', FileText, 'users'),
      // Named for the product, not for the page's contents: an operator looks
      // for "Jobs", never for "Sumber Lowongan".
      item('Jobs', '/app/admin/careers', Briefcase, 'careers'),
      {
        kind: 'nest',
        nest: {
          label: 'Arena',
          icon: Trophy,
          sections: [
            {
              label: 'Siapkan',
              items: [
                { label: 'Project', href: '/app/admin/projects', icon: FolderKanban, scope: 'projects' },
                { label: 'Divisi', href: '/app/admin/divisions', icon: Layers, scope: 'projects' },
                { label: 'Minggu', href: '/app/admin/weeks', icon: CalendarClock, scope: 'weeks' },
              ],
            },
            {
              label: 'Jalankan',
              items: [
                // Trigger Workflow used to sit beside this and do the same job.
                // It now lives inside Otomasi; /app/admin/workflows redirects.
                { label: 'Otomasi', href: '/app/admin/jobs', icon: Workflow, scope: 'overview' },
                { label: 'Review', href: '/app/admin/reviews', icon: ClipboardCheck, scope: 'reviews' },
              ],
            },
            {
              label: 'Hasil',
              items: [{ label: 'Reward', href: '/app/admin/rewards', icon: Gift, scope: 'rewards' }],
            },
          ],
        },
      },
    ],
  },
  {
    label: 'Lintas Produk',
    entries: [
      item('Peserta', '/app/admin/users', Users, 'users'),
      item('Email', '/app/admin/email', Mail, 'notifications'),
      item('Saklar Darurat', '/app/admin/flags', ShieldAlert, 'projects'),
      item('Audit Log', '/app/admin/audit', ListChecks, 'overview'),
    ],
  },
];

function isActive(href: string, pathname: string) {
  return href === '/app/admin' ? pathname === href : pathname.startsWith(href);
}

/**
 * A count, and never a decorative one.
 *
 * Every badge comes from a health signal, so its presence means there is
 * something to do — which is what lets a rail with no numbers be read as "all
 * clear" rather than "no data". The count is paired with `sr-only` text so the
 * state does not depend on colour alone.
 */
function Badge({ badge }: { badge: NavBadge }) {
  return (
    <span
      className={cn(
        'ml-auto rounded-full px-1.5 text-[10px] font-extrabold leading-[1.45]',
        badge.level === 'ALERT' ? 'bg-sk-error-wash text-sk-error' : 'bg-sk-warning-wash text-sk-warning-ink',
      )}
    >
      {badge.count}
      <span className="sr-only"> {badge.label}</span>
    </span>
  );
}

export function AdminSidebar({
  subject,
  scopes,
  badges = {},
}: {
  subject: string;
  scopes: ArenaAdminScope[];
  badges?: Record<string, NavBadge>;
}) {
  const pathname = usePathname();
  const allowed = (entry: NavItem) => entry.scope === null || scopes.includes(entry.scope);

  // Scope filtering runs before anything is numbered. A static "1 · Siapkan"
  // would read as a bug the moment an admin without `projects` sees a rail that
  // starts at 2, so the numbers are assigned to whatever survived the filter.
  const visible = GROUPS
    .map((group) => ({
      ...group,
      entries: group.entries.flatMap<Entry>((entry) => {
        if (entry.kind === 'item') return allowed(entry.item) ? [entry] : [];
        const sections = entry.nest.sections
          .map((section) => ({ ...section, items: section.items.filter(allowed) }))
          .filter((section) => section.items.length > 0);
        return sections.length > 0 ? [{ kind: 'nest', nest: { ...entry.nest, sections } }] : [];
      }),
    }))
    .filter((group) => group.entries.length > 0);

  const renderItem = ({ href, label, icon: Icon }: NavItem) => {
    const active = isActive(href, pathname);
    const badge = badges[href];
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
          {badge && <Badge badge={badge} />}
        </Link>
      </li>
    );
  };

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
              {group.entries.map((entry) =>
                entry.kind === 'item' ? (
                  renderItem(entry.item)
                ) : (
                  <li key={entry.nest.label}>
                    <p className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-bold text-sk-navy">
                      <entry.nest.icon size={16} aria-hidden />
                      {entry.nest.label}
                    </p>
                    <div className="ml-[18px] border-l border-sk-border pl-2">
                      {entry.nest.sections.map((section, index) => (
                        <div key={section.label}>
                          <p className="mb-1 mt-2 px-2.5 text-[9.5px] font-bold uppercase tracking-wider text-sk-muted first:mt-0">
                            {index + 1} · {section.label}
                          </p>
                          <ul className="space-y-0.5">{section.items.map(renderItem)}</ul>
                        </div>
                      ))}
                    </div>
                  </li>
                ),
              )}
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
        <LogoutForm>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-[var(--radius-sk)] px-2.5 py-2 text-left text-[13px] font-medium text-sk-error transition-colors hover:bg-sk-error-wash"
          >
            <LogOut size={16} aria-hidden />
            Keluar
          </button>
        </LogoutForm>
      </div>
    </aside>
  );
}
