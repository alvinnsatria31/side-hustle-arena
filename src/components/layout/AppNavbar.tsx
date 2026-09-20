'use client';

import Link from 'next/link';
import { LogoutForm } from '@/components/auth/LogoutForm';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { appNavLinks, isNavActive } from '@/components/layout/nav-links';
import { ExternalMark, NavAnchor, NewBadge, PROMO_PILL } from '@/components/layout/NavPromo';
import { useIsAdmin, useParticipant } from '@/features/arena/participant';
import { getNotifications } from '@/lib/arena-client';
import { cn } from '@/lib/cn';

/**
 * Glass app navbar: wordmark, the participant's sections, then identity.
 *
 * The link row scrolls sideways rather than wrapping. Which sections exist
 * depends on which launch flags are on, so the row's width is not fixed, and a
 * wrapping row would push the bar to two lines on exactly the screens with the
 * least room for it.
 */
export function AppNavbar() {
  const pathname = usePathname();
  const user = useParticipant();
  const isAdmin = useIsAdmin();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const links = appNavLinks();
  const sectionTitle =
    pathname === '/app/arena' || pathname === '/app'
      ? 'Ringkasan'
      : pathname.startsWith('/app/arena/my-projects')
        ? 'Proyekku'
        : pathname.startsWith('/app/arena/projects')
          ? 'Jelajahi proyek'
          : pathname.startsWith('/app/arena/leaderboard')
            ? 'Peringkat'
            : pathname.startsWith('/app/profile')
              ? 'Profil'
              : 'Ruang kerja';

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
    <header className="sticky top-0 z-40 border-b border-sk-border bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <nav
        className="mx-auto flex h-[68px] max-w-6xl items-center gap-4"
        aria-label="Navigasi aplikasi"
      >
        <BrandLogo href="/app/arena" className="lg:hidden" />
        <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-sk-faint lg:block">
          Arena / <span className="text-sk-blue-700">{sectionTitle}</span>
        </span>

        <div className="ml-auto flex items-center gap-2.5" ref={menuRef}>
          <Link
            href="/app/notifications"
            onClick={() => setMenuOpen(false)}
            title="Notifikasi"
            aria-label={`Notifikasi, ${unread} belum dibaca`}
            className="relative grid h-10 w-10 place-items-center rounded-full text-sk-muted transition-colors hover:bg-white/70 hover:text-sk-navy focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
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
            className="flex h-10 items-center gap-2 rounded-full pl-1 pr-1 transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2 lg:pr-3"
          >
            {/* The initial stands in only until they have picked: the picker
                runs on arrival, so this is what the first paint shows and not a
                state anyone stays in. */}
            {user.avatarId ? (
              <AvatarBadge avatarId={user.avatarId} size="sm" className="h-9 w-9 text-[18px]" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sk-blue to-sk-blue-400 text-[14px] font-bold text-white">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="hidden max-w-[9rem] truncate text-[13px] font-semibold text-sk-navy lg:inline">
              {name}
            </span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Menu pengguna"
          className="fixed right-4 top-16 z-50 w-60 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-1.5 shadow-sk-lg sm:right-6"
        >
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            {user.avatarId ? <AvatarBadge avatarId={user.avatarId} size="sm" /> : null}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-sk-navy">{name}</p>
              <p className="break-all font-mono text-[10.5px] text-sk-muted">{user.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-sk-border" />

          {/* Sections that did not fit the bar on this screen still need a way
              in, so the menu carries the whole list on small viewports. */}
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
                      ? cn('font-semibold duration-200', PROMO_PILL)
                      : 'font-medium text-sk-body hover:bg-sk-bg',
                    !link.highlight && active && 'bg-sk-blue-tint font-semibold text-sk-blue-700',
                  )}
                >
                  <Icon size={15} strokeWidth={2.1} aria-hidden /> {link.label}
                  {link.highlight && <NewBadge className="ml-auto" />}
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
