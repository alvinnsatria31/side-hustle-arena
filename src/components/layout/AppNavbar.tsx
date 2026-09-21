'use client';

import Link from 'next/link';
import { LogoutForm } from '@/components/auth/LogoutForm';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Coins, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { StaircaseMark } from '@/components/brand/BrandLogo';
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { REWARDS_PATH, appNavLinks, isNavActive } from '@/components/layout/nav-links';
import { ExternalMark, NavAnchor, NewBadge, TOOLS_BUTTON } from '@/components/layout/NavPromo';
import { useIsAdmin, useParticipant } from '@/features/arena/participant';
import { getNotifications } from '@/lib/arena-client';
import { POINTS_CHANGED_EVENT, getParticipantPoints } from '@/lib/participant-client';
import { cn } from '@/lib/cn';

/** Spendable balance for the points pill; re-read on navigation, focus and after a spend. */
function usePointBalance(pathname: string) {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      getParticipantPoints()
        .then((data) => {
          if (active) setBalance(data.balance);
        })
        .catch(() => {});
    void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener(POINTS_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener(POINTS_CHANGED_EVENT, refresh);
    };
  }, [pathname]);
  return balance;
}

/**
 * The participant's top bar: brand, the Arena sections, the Tools promo, then
 * points, notifications and identity.
 *
 * It replaced the dark sidebar on 2026-09-22 at the owner's request. The
 * current page is an underline under its label rather than a filled pill,
 * which is what frees the Tools button to be solid brand blue.
 *
 * Section links show from `md`; below that the bottom tab bar is the
 * navigation and the avatar menu carries the full list. The link row scrolls
 * sideways rather than wrapping when a tablet is too narrow for all of it.
 */
export function AppNavbar() {
  const pathname = usePathname();
  const user = useParticipant();
  const isAdmin = useIsAdmin();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const balance = usePointBalance(pathname);
  const links = appNavLinks();
  const sections = links.filter((link) => !link.highlight);
  const promos = links.filter((link) => link.highlight);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      getNotifications({ limit: 1 })
        .then((data) => {
          if (active) setUnread(data.unread);
        })
        .catch(() => {});
    void refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const name = user.displayName ?? 'Peserta';

  return (
    <header className="anim-fade-in sticky top-0 z-40 border-b border-sk-border bg-white/90 shadow-[0_1px_12px_rgba(16,37,68,0.06)] backdrop-blur-md">
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 md:h-[68px] md:gap-6 lg:px-8"
        aria-label="Navigasi aplikasi"
      >
        <Link
          href="/app/arena"
          aria-label="Side Hustle Arena — Ringkasan"
          className="flex shrink-0 items-center gap-2.5 rounded-[var(--radius-sk-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
        >
          <StaircaseMark className="h-9 w-9 shrink-0 text-sk-blue" />
          <span className="leading-tight md:max-lg:hidden">
            <span className="block whitespace-nowrap text-[15px] font-extrabold tracking-[-0.02em] text-sk-navy">
              Side Hustle Arena
            </span>
            <span className="mt-0.5 block font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-sk-faint">
              by SekolahKarir
            </span>
          </span>
        </Link>

        <div className="no-scrollbar hidden min-w-0 flex-1 items-stretch gap-1 self-stretch overflow-x-auto md:flex">
          {sections.map((link) => {
            const active = isNavActive(link.href, pathname);
            return (
              <NavAnchor
                key={link.href}
                link={link}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex shrink-0 items-center whitespace-nowrap px-3 text-[13.5px] transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-sk-blue',
                  active ? 'font-bold text-sk-navy' : 'font-semibold text-sk-muted hover:text-sk-navy',
                )}
              >
                {link.label}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-3 bottom-0 h-[2px] origin-center rounded-full bg-sk-blue transition-transform duration-300 ease-out',
                    active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50',
                  )}
                />
              </NavAnchor>
            );
          })}
          {promos.map((link) => (
            <NavAnchor
              key={link.href}
              link={link}
              className={cn(
                'my-auto ml-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full pl-3.5 pr-1.5 text-[13px] font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue',
                TOOLS_BUTTON,
              )}
            >
              {link.label}
              <NewBadge tone="blue" />
            </NavAnchor>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5" ref={menuRef}>
          <Link
            href={REWARDS_PATH}
            aria-label={balance === null ? 'Poin kamu' : `Poin tersedia: ${balance.toLocaleString('id-ID')}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#f0dfb8] bg-sk-deadline-tint px-3 text-sk-warning-ink transition-colors hover:border-sk-warning/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue sm:h-10 sm:px-3.5"
          >
            <Coins size={15} aria-hidden className="shrink-0" />
            <span className="font-mono text-[12.5px] font-bold tabular-nums">
              {balance === null ? '—' : balance.toLocaleString('id-ID')}
              <span className="max-sm:hidden"> poin</span>
            </span>
          </Link>

          <Link
            href="/app/notifications"
            title="Notifikasi"
            aria-label={`Notifikasi, ${unread} belum dibaca`}
            className="relative grid h-10 w-10 place-items-center rounded-full text-sk-muted transition-colors hover:bg-sk-bg hover:text-sk-navy focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
          >
            <Bell size={19} aria-hidden />
            {unread > 0 && (
              <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-sk-error px-1 text-center font-mono text-[10px] font-bold leading-4 text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Menu pengguna, ${name}`}
            className="flex h-10 items-center gap-1.5 rounded-full pl-0.5 pr-1.5 transition-colors hover:bg-sk-bg focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
          >
            <AvatarBadge avatarId={user.avatarId} seed={user.displayName ?? user.email} size="sm" className="h-9 w-9" />
            <ChevronDown
              size={15}
              aria-hidden
              className={cn('text-sk-muted transition-transform duration-200', menuOpen && 'rotate-180')}
            />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Menu pengguna"
          className="anim-scale-in fixed right-4 top-[68px] z-50 w-64 origin-top-right rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-1.5 shadow-sk-lg sm:right-6"
        >
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <AvatarBadge avatarId={user.avatarId} seed={user.displayName ?? user.email} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-sk-navy">{name}</p>
              <p className="break-all font-mono text-[10.5px] text-sk-muted">{user.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-sk-border" />

          {/* Sections the bar hides on this screen still need a way in, so the
              menu carries the whole list below `md`. */}
          <div className="md:hidden">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isNavActive(link.href, pathname);
              return (
                <NavAnchor
                  key={link.href}
                  link={link}
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors',
                    link.highlight
                      ? cn('font-semibold duration-200', TOOLS_BUTTON)
                      : 'font-medium text-sk-body hover:bg-sk-bg',
                    !link.highlight && active && 'bg-sk-blue-tint font-semibold text-sk-blue-700',
                  )}
                >
                  <Icon size={15} strokeWidth={2.1} aria-hidden /> {link.label}
                  {link.highlight && <NewBadge tone="blue" className="ml-auto" />}
                  {link.external && <ExternalMark />}
                </NavAnchor>
              );
            })}
            <div className="my-1 h-px bg-sk-border" />
          </div>

          {isAdmin && (
            <Link
              href="/app/admin"
              onClick={() => setMenuOpen(false)}
              role="menuitem"
              className="flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-sk-body transition-colors hover:bg-sk-bg"
            >
              <ShieldCheck size={15} aria-hidden /> Admin
            </Link>
          )}
          <Link
            href="/app/profile"
            onClick={() => setMenuOpen(false)}
            role="menuitem"
            className="flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-sk-body transition-colors hover:bg-sk-bg"
          >
            <UserRound size={15} aria-hidden /> Profil
          </Link>
          <LogoutForm>
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] font-medium text-sk-error transition-colors hover:bg-sk-error-wash"
            >
              <LogOut size={15} aria-hidden /> Keluar
            </button>
          </LogoutForm>
        </div>
      )}
    </header>
  );
}
