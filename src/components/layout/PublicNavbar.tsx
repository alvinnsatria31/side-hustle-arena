'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ButtonLink } from '@/components/primitives/Button';
import { PublicUserMenu, type PublicNavUser } from '@/components/layout/PublicUserMenu';
import { cn } from '@/lib/cn';
/**
 * Five entries, centred, in the order a first-time visitor needs them:
 * what this is, how it is judged, what is open now, who has won, what it pays.
 *
 * Judging sits second on purpose. It is the objection that stops people
 * entering a competition, so it gets a nav slot rather than only a section
 * someone has to scroll far enough to find.
 */
const NAV_LINKS = [
  { label: 'Cara kerja', href: '/arena' },
  { label: 'Penilaian', href: '/#nilai' },
  { label: 'Proyek', href: '/arena/projects' },
  { label: 'Sorotan', href: '/arena/showcase' },
  { label: 'Hadiah', href: '/#hadiah' },
];

/**
 * Floating glass navbar. More transparent at top; slightly smaller and
 * more opaque on scroll (approved navbar motion).
 *
 * `user` comes from the layout, which reads the shared Sekolah Karir session on
 * the server. It matters that this is resolved before paint rather than fetched
 * after it: a participant who is already signed in must never be shown "Masuk",
 * not even for the frame it would take a client-side check to come back.
 */
export function PublicNavbar({ user }: { user: PublicNavUser | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <motion.nav
        layout
        transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
        className={cn(
          'glass-nav mx-auto flex max-w-6xl items-center gap-6 rounded-[var(--radius-sk-xl)] transition-all duration-300 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-8',
          scrolled ? 'bg-white/90 px-3.5 py-2 shadow-sk-glass' : 'px-4 py-2.5 lg:px-6 lg:py-3',
        )}
        aria-label="Navigasi utama"
      >
        <BrandLogo />

        {/* Centre column: the links sit in the middle of the bar, not beside
            the wordmark, so the bar stays balanced as labels change length. */}
        <ul className="hidden items-center justify-center gap-7 text-[13px] font-medium text-sk-body lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  'whitespace-nowrap transition-colors hover:text-sk-navy',
                  isActive(link.href) && 'font-semibold text-sk-navy',
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center justify-end gap-3 lg:flex">
          {user ? (
            <>
              <ButtonLink href="/app" size="sm" className="rounded-full">
                Buka Arena
              </ButtonLink>
              <PublicUserMenu user={user} />
            </>
          ) : (
            <>
              <Link href="/login" className="text-[13px] font-semibold text-sk-navy transition-colors hover:text-sk-blue">
                Masuk
              </Link>
              <ButtonLink href="/arena/projects" size="sm" className="rounded-full">
                Ikut sprint ini
              </ButtonLink>
            </>
          )}
        </div>

        <button
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-sk-navy lg:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </motion.nav>

      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="glass-nav mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-[var(--radius-sk-xl)] p-3 lg:hidden"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-sk-body transition-colors hover:bg-white hover:text-sk-navy',
                isActive(link.href) && 'font-semibold text-sk-navy',
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center gap-2 border-t border-sk-border pt-3">
            {user ? (
              <>
                <ButtonLink href="/app" size="sm" className="flex-1">
                  Buka Arena
                </ButtonLink>
                <PublicUserMenu user={user} />
              </>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm" className="flex-1">
                  Masuk
                </ButtonLink>
                <ButtonLink href="/arena" size="sm" className="flex-1">
                  Jelajahi Arena
                </ButtonLink>
              </>
            )}
          </div>
        </motion.div>
      )}
    </header>
  );
}
