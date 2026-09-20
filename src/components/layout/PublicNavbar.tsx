'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ButtonLink } from '@/components/primitives/Button';
import { PublicUserMenu, type PublicNavUser } from '@/components/layout/PublicUserMenu';
import { isNavActive, publicNavLinks } from '@/components/layout/nav-links';
import { ExternalMark, NavAnchor, NewBadge, PROMO_PILL } from '@/components/layout/NavPromo';
import { cn } from '@/lib/cn';

/**
 * Floating glass navbar. More transparent at top; slightly smaller and
 * more opaque on scroll (approved navbar motion).
 *
 * The links sit in the middle column of a three-column grid rather than beside
 * the wordmark, so the bar stays balanced as labels are added or renamed.
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
  const links = publicNavLinks();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <motion.nav
        layout
        transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
        className={cn(
          'glass-nav mx-auto flex max-w-6xl items-center gap-6 rounded-[var(--radius-sk-xl)] transition-all duration-300',
          'lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-8',
          scrolled ? 'bg-white/90 px-3.5 py-2 shadow-sk-glass' : 'px-4 py-2.5 lg:px-6 lg:py-3',
        )}
        aria-label="Navigasi utama"
      >
        <BrandLogo />

        <ul className="hidden items-center justify-center gap-6 text-[13px] font-medium text-sk-body lg:flex xl:gap-7">
          {links.map((link) => (
            <li key={link.href}>
              <NavAnchor
                link={link}
                aria-current={isNavActive(link.href, pathname) ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap transition-colors',
                  link.highlight
                    ? cn(
                        'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 font-semibold duration-200',
                        PROMO_PILL,
                      )
                    : 'hover:text-sk-navy',
                  !link.highlight &&
                    isNavActive(link.href, pathname) &&
                    'font-semibold text-sk-navy',
                )}
              >
                {link.label}
                {link.highlight && <NewBadge />}
                {link.external && <ExternalMark />}
              </NavAnchor>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center justify-end gap-3 lg:ml-0 lg:flex">
          {user ? (
            <>
              <ButtonLink href="/app" size="sm" className="rounded-full">
                Buka Arena
              </ButtonLink>
              <PublicUserMenu user={user} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] font-semibold text-sk-navy transition-colors hover:text-sk-blue"
              >
                Masuk
              </Link>
              <ButtonLink href="/arena/projects" size="sm" className="rounded-full">
                Ikut sprint ini
              </ButtonLink>
            </>
          )}
        </div>

        <button
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-[var(--radius-sk-md)] text-sk-navy transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2 lg:hidden"
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
          transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
          /* Solid, not glass. This sheet covers the hero, and `.glass-nav`'s
             72% white lets the headline behind it show through the links —
             legible enough to look intentional, and not legible enough to
             read. A panel laid over content has to be opaque. */
          className="mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-3 shadow-sk-lg lg:hidden"
        >
          {links.map((link) => {
            const Icon = link.icon;
            const active = isNavActive(link.href, pathname);
            return (
              <NavAnchor
                key={link.href}
                link={link}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[44px] items-center gap-3 rounded-[var(--radius-sk-md)] px-3 text-[14px] transition-colors',
                  link.highlight
                    ? cn('font-semibold duration-200', PROMO_PILL)
                    : 'font-medium text-sk-body hover:bg-sk-bg hover:text-sk-navy',
                  !link.highlight && active && 'bg-sk-blue-tint font-semibold text-sk-blue-700',
                )}
              >
                <Icon size={17} strokeWidth={2.1} aria-hidden className="flex-none" />
                {link.label}
                {link.highlight && <NewBadge className="ml-auto" />}
                {link.external && <ExternalMark className={link.highlight ? '' : 'ml-auto'} />}
              </NavAnchor>
            );
          })}

          <div className="mt-2 flex items-center gap-2 border-t border-sk-border pt-3">
            {user ? (
              <>
                <ButtonLink href="/app" size="sm" className="flex-1 rounded-full">
                  Buka Arena
                </ButtonLink>
                <PublicUserMenu user={user} />
              </>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm" className="flex-1 rounded-full">
                  Masuk
                </ButtonLink>
                <ButtonLink href="/arena/projects" size="sm" className="flex-1 rounded-full">
                  Ikut sprint
                </ButtonLink>
              </>
            )}
          </div>
        </motion.div>
      )}
    </header>
  );
}
