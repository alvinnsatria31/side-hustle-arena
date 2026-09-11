'use client';

import Link from 'next/link';
import { LogoutForm } from '@/components/auth/LogoutForm';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { useIsAdmin, useParticipant } from '@/features/arena/participant';
import { getNotifications } from '@/lib/arena-client';
import { cn } from '@/lib/cn';
import { isCvScannerEnabled } from '@/lib/cv-scan-limits';

const APP_LINKS_ALL = [
  { label: 'Home', href: '/app' },
  { label: 'CV Scanner', href: '/app/cv-scanner' },
  { label: 'Arena', href: '/app/arena' },
  { label: 'Career Report', href: '/app/career-report' },
  { label: 'Jobs', href: '/app/jobs' },
];

/** The CV Scanner stays out of navigation until its backend is switched on. */
const APP_LINKS = APP_LINKS_ALL.filter((item) => !item.href.includes('/cv-scanner') || isCvScannerEnabled());

const APP_BASE = '/app';

/** Glass app navbar with centered section links and avatar menu. */
export function AppNavbar() {
  const pathname = usePathname();
  const user = useParticipant();
  const isAdmin = useIsAdmin();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => getNotifications({ limit: 1 }).then((data) => { if (active) setUnread(data.unread); }).catch(() => {});
    void refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { active = false; window.clearInterval(timer); };
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === APP_BASE ? pathname === APP_BASE : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
      <nav
        className="glass-nav mx-auto flex max-w-6xl items-center gap-4 rounded-[var(--radius-sk-xl)] px-4 py-2.5 md:px-5"
        aria-label="Navigasi aplikasi"
      >
        <BrandLogo />

        <ul className="mx-auto hidden items-center gap-1 md:flex">
          {APP_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={cn(
                  'rounded-[var(--radius-sk)] px-3.5 py-2 text-[13px] font-medium text-sk-muted transition-colors hover:text-sk-navy',
                  isActive(link.href) && 'bg-sk-blue-tint font-bold text-sk-blue hover:text-sk-blue',
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3 md:ml-0" ref={menuRef}>
          <Link href="/app/notifications" title="Notifikasi" aria-label={`Notifikasi, ${unread} belum dibaca`} className="relative p-2 text-sk-muted">
            <Bell size={19} />
            {unread > 0 && <span className="absolute right-0 top-0 rounded-full bg-sk-error px-1 text-[10px] text-white">{unread > 99 ? '99+' : unread}</span>}
          </Link>
          <span className="hidden font-mono text-[11px] text-sk-muted lg:inline">
            {user.displayName ?? 'Peserta'}
          </span>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Menu pengguna"
            className="flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            {/* The initial stands in only until they have picked: the picker
                runs on arrival, so this is what the first paint shows and not a
                state anyone stays in. */}
            {user.avatarId ? (
              <AvatarBadge avatarId={user.avatarId} size="sm" className="h-9 w-9 text-[18px]" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sk-blue to-sk-blue-400 text-[14px] font-bold text-white">
                {(user.displayName ?? 'Peserta').slice(0, 1).toUpperCase()}
              </span>
            )}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Menu pengguna"
          className="fixed right-4 top-16 z-50 w-56 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-1.5 shadow-sk-lg sm:right-6"
        >
          <div className="flex items-center gap-2.5 px-3 py-2">
            {user.avatarId ? <AvatarBadge avatarId={user.avatarId} size="sm" /> : null}
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-sk-navy">{user.displayName ?? 'Peserta'}</p>
              <p className="break-all font-mono text-[10.5px] text-sk-muted">{user.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-sk-border" />
          {isAdmin && (
            <Link
              href="/app/admin"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-sk-body transition-colors hover:bg-sk-bg"
            >
              <ShieldCheck size={15} aria-hidden /> Admin
            </Link>
          )}
          <Link
            href="/app/profile"
            role="menuitem"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-sk-body transition-colors hover:bg-sk-bg"
          >
            <UserRound size={15} aria-hidden /> Profil
          </Link>
          <LogoutForm>
          <button
            type="submit"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-sk-error transition-colors hover:bg-sk-error-wash"
          >
            <LogOut size={15} aria-hidden /> Keluar
          </button>
          </LogoutForm>
        </div>
      )}
    </header>
  );
}
