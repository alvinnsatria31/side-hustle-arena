'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { LogoutForm } from '@/components/auth/LogoutForm';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Coins, LogOut, ShieldCheck, UserRound } from 'lucide-react';
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

  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [bellHovered, setBellHovered] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#F0F2F5] bg-white/95 shadow-[0_1px_8px_rgba(15,23,42,0.03)] backdrop-blur-md">
      <nav
        className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 md:gap-6 lg:px-8"
        aria-label="Navigasi aplikasi"
      >
        <Link
          href="/app/arena"
          aria-label="Side Hustle Arena — Ringkasan"
          className="group flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
        >
          <Image
            src="/logo.png"
            alt="Side Hustle Arena by SekolahKarir"
            width={195}
            height={40}
            className="h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02] sm:h-10"
            priority
            unoptimized
          />
        </Link>

        <div
          onMouseLeave={() => setHoveredHref(null)}
          className="no-scrollbar hidden min-w-0 flex-1 items-stretch justify-center gap-1 self-stretch overflow-x-auto md:flex lg:gap-2"
        >
          {sections.map((link) => {
            const active = isNavActive(link.href, pathname);
            const isHovered = hoveredHref === link.href;

            return (
              <NavAnchor
                key={link.href}
                link={link}
                aria-current={active ? 'page' : undefined}
                onMouseEnter={() => setHoveredHref(link.href)}
                className={cn(
                  'group relative flex shrink-0 items-center whitespace-nowrap px-3.5 text-[14px] transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-sk-blue',
                  active ? 'font-bold text-sk-navy' : 'font-semibold text-slate-500 hover:text-sk-navy',
                )}
              >
                {/* Pre-click floating backdrop pill */}
                {isHovered && (
                  <motion.div
                    layoutId="navbar-hover-pill"
                    className="absolute inset-x-1 inset-y-3 -z-10 rounded-full bg-slate-100/90"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}

                {/* Subtle text lift before click */}
                <motion.span
                  animate={{ y: isHovered ? -1 : 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative z-10"
                >
                  {link.label}
                </motion.span>

                {/* Active CardChase bottom indicator */}
                {active && (
                  <motion.span
                    layoutId="active-nav-indicator"
                    className="absolute inset-x-2.5 bottom-0 h-[3px] rounded-full bg-[#026bf4]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </NavAnchor>
            );
          })}

          {promos.map((link) => (
            <motion.div
              key={link.href}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="my-auto ml-1"
            >
              <NavAnchor
                link={link}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full pl-3.5 pr-1.5 text-[13px] font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue',
                  TOOLS_BUTTON,
                )}
              >
                {link.label}
                <NewBadge tone="blue" />
              </NavAnchor>
            </motion.div>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3" ref={menuRef}>
          <motion.div
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Link
              href={REWARDS_PATH}
              aria-label={balance === null ? 'Poin kamu' : `Poin tersedia: ${balance.toLocaleString('id-ID')}`}
              className="group inline-flex h-10 items-center gap-2 rounded-full border border-[#FDE6C8] bg-[#FFF9EE] px-3.5 text-[#0F172A] shadow-xs transition-all hover:border-[#FCD399] hover:bg-[#FFF4DD] hover:shadow-[0_4px_14px_rgba(245,158,11,0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue sm:px-4"
            >
              <motion.div
                whileHover={{ rotate: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F59E0B]/15 text-[#D97706]"
              >
                <Coins size={13} strokeWidth={2.4} aria-hidden />
              </motion.div>
              <span className="font-mono text-[13px] font-bold tabular-nums tracking-tight">
                {balance === null ? '—' : balance.toLocaleString('id-ID')}
                <span className="font-sans font-semibold text-slate-700 max-sm:hidden"> poin</span>
              </span>
            </Link>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.06, y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="relative"
          >
            <Link
              href="/app/notifications"
              title="Notifikasi"
              aria-label={`Notifikasi, ${unread} belum dibaca`}
              onMouseEnter={() => setBellHovered(true)}
              onMouseLeave={() => setBellHovered(false)}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-[#E2E8F0] bg-white text-[#2563EB] shadow-xs transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
            >
              <motion.div
                animate={bellHovered ? { rotate: [0, -16, 14, -10, 6, 0] } : { rotate: 0 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              >
                <Bell size={18} strokeWidth={2.1} aria-hidden />
              </motion.div>
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sk-error px-1 text-center font-mono text-[10px] font-bold leading-none text-white ring-2 ring-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Menu pengguna, ${name}`}
            className="flex h-10 items-center gap-1.5 rounded-full p-0.5 transition-all hover:ring-2 hover:ring-sk-blue/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
          >
            <AvatarBadge
              avatarId={user.avatarId}
              seed={user.displayName ?? user.email}
              size="sm"
              className="h-9 w-9 rounded-full ring-2 ring-white shadow-xs"
            />
            <ChevronDown
              size={14}
              strokeWidth={2.4}
              aria-hidden
              className={cn('text-slate-500 transition-transform duration-200', menuOpen && 'rotate-180')}
            />
          </motion.button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="menu"
            aria-label="Menu pengguna"
            className="fixed right-4 top-[76px] z-50 w-64 origin-top-right rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-1.5 shadow-sk-lg sm:right-6"
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
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
