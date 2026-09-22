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
 * The participant's top bar: brand left, CardChase-style segmented sections in
 * the middle, the Tools promo, then points, notifications and identity.
 *
 * Desktop center is a capsule (`bg-[#EEF2F7]`) with one sliding white pill for
 * the active page. Hover is pure CSS on purpose: the old hover pill used its
 * own layoutId and got stuck when the pointer moved fast between links.
 *
 * First-visit nudge: links the user has never clicked gently wiggle with a
 * blue dot. Any single click sets `sha-nav-seen-v1` and kills it for good.
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

        {/* Tengah desktop ala CardChase: segmented pill di dalam kapsul.
            Logo tetap di kiri (link di atas tidak diubah). Bug hover nyangkut
            diperbaiki dengan menghapus hover pill layoutId — hover kini murni
            CSS, yang sliding hanya pill aktif. */}
        {/* Tengah desktop ala CardChase: segmented pill di dalam kapsul.
            Ramping, tenang, dan proporsional tanpa animasi gerak yang mengganggu. */}
        <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-0.5 rounded-full border border-[#E6EBF2] bg-[#EEF2F7] p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
            {sections.map((link) => {
              const active = isNavActive(link.href, pathname);

              return (
                <NavAnchor
                  key={link.href}
                  link={link}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue',
                    active
                      ? 'font-bold text-sk-navy'
                      : 'font-semibold text-slate-500 hover:bg-white/70 hover:text-sk-navy',
                  )}
                >
                  {/* Pill aktif yang tenang */}
                  {active && (
                    <motion.span
                      layoutId="cardchase-active-pill"
                      className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </NavAnchor>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3" ref={menuRef}>
          {promos.map((link) => (
            <NavAnchor
              key={link.href}
              link={link}
              className={cn(
                'hidden lg:inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-3.5 pr-2 text-[13px] font-bold transition-all hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue',
                TOOLS_BUTTON,
              )}
            >
              {link.label}
              <NewBadge tone="blue" />
            </NavAnchor>
          ))}

          <Link
            href={REWARDS_PATH}
            aria-label={balance === null ? 'Poin kamu' : `Poin tersedia: ${balance.toLocaleString('id-ID')}`}
            className="group inline-flex h-10 items-center gap-2 rounded-full border border-[#FDE6C8] bg-[#FFF9EE] px-3.5 text-[#0F172A] shadow-xs transition-all hover:border-[#FCD399] hover:bg-[#FFF4DD] hover:shadow-[0_4px_14px_rgba(245,158,11,0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue sm:px-4"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F59E0B]/15 text-[#D97706]">
              <Coins size={13} strokeWidth={2.4} aria-hidden />
            </div>
            <span className="font-mono text-[13px] font-bold tabular-nums tracking-tight">
              {balance === null ? '—' : balance.toLocaleString('id-ID')}
              <span className="font-sans font-semibold text-slate-700 max-sm:hidden"> poin</span>
            </span>
          </Link>

          <div className="relative">
            <Link
              href="/app/notifications"
              title="Notifikasi"
              aria-label={`Notifikasi, ${unread} belum dibaca`}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-[#E2E8F0] bg-white text-[#2563EB] shadow-xs transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
            >
              <Bell size={18} strokeWidth={2.1} aria-hidden />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sk-error px-1 text-center font-mono text-[10px] font-bold leading-none text-white ring-2 ring-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          </div>

          <button
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
          </button>
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

            {/* Tools entry for screens smaller than lg (tablet & mobile) */}
            <div className="lg:hidden">
              {promos.map((link) => {
                const Icon = link.icon;
                return (
                  <NavAnchor
                    key={link.href}
                    link={link}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className={cn(
                      'flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-semibold transition-colors mb-1',
                      TOOLS_BUTTON,
                    )}
                  >
                    <Icon size={15} strokeWidth={2.1} aria-hidden /> {link.label}
                    <NewBadge tone="blue" className="ml-auto" />
                    {link.external && <ExternalMark />}
                  </NavAnchor>
                );
              })}
            </div>

            {/* Sections the bar hides on mobile (below md) */}
            <div className="md:hidden">
              {sections.map((link) => {
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
                      'flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-sk-body transition-colors hover:bg-sk-bg',
                      active && 'bg-sk-blue-tint font-semibold text-sk-blue-700',
                    )}
                  >
                    <Icon size={15} strokeWidth={2.1} aria-hidden /> {link.label}
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
