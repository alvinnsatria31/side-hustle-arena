'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogOut, RotateCcw, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useDemo } from '@/features/demo/store';
import { useToast } from '@/features/ui/toast';
import { cn } from '@/lib/cn';

const APP_LINKS = [
  { label: 'Home', href: '/app' },
  { label: 'CV Scanner', href: '/app/cv-scanner' },
  { label: 'Arena', href: '/app/arena' },
  { label: 'Career Report', href: '/app/career-report' },
  { label: 'Jobs', href: '/app/jobs' },
];

const APP_BASE = '/app';

/** Glass app navbar with centered section links and avatar menu. */
export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, logout, resetDemo } = useDemo();
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleReset = () => {
    resetDemo();
    showToast('Demo direset. Data kembali ke awal.');
    router.push('/app');
  };

  const handleLogout = () => {
    logout();
    showToast('Sesi demo ditutup.');
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
      <nav
        className="glass-nav mx-auto flex max-w-6xl items-center gap-4 rounded-[var(--radius-sk-xl)] px-4 py-2.5 md:px-5"
        aria-label="Navigasi aplikasi"
      >
        <BrandLogo className="hidden sm:flex" />
        <BrandLogo compact className="sm:hidden" />

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
          <span className="hidden font-mono text-[11px] text-sk-muted lg:inline">
            {state.user ? state.user.displayName : 'Demo'}
          </span>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Menu pengguna"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sk-blue to-sk-blue-400 text-[14px] font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            {state.user?.initials ?? 'A'}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Menu pengguna"
          className="fixed right-4 top-16 z-50 w-56 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-1.5 shadow-sk-lg sm:right-6"
        >
          <div className="px-3 py-2">
            <p className="text-[13px] font-bold text-sk-navy">{state.user?.displayName ?? 'Alvin (demo)'}</p>
            <p className="font-mono text-[10.5px] text-sk-muted">{state.user?.email ?? 'sesi demo lokal'}</p>
          </div>
          <div className="my-1 h-px bg-sk-border" />
          <Link
            href="/app/profile"
            role="menuitem"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-sk-body transition-colors hover:bg-sk-bg"
          >
            <UserRound size={15} aria-hidden /> Profil
          </Link>
          <button
            role="menuitem"
            onClick={handleReset}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-sk-body transition-colors hover:bg-sk-bg"
          >
            <RotateCcw size={15} aria-hidden /> Reset demo
          </button>
          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-sk-error transition-colors hover:bg-sk-error-wash"
          >
            <LogOut size={15} aria-hidden /> Keluar
          </button>
        </div>
      )}
    </header>
  );
}
