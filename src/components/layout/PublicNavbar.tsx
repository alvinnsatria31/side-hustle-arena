'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ButtonLink } from '@/components/primitives/Button';
import { cn } from '@/lib/cn';

const NAV_LINKS = [
  { label: 'CV Scanner', href: '/cv-scanner' },
  { label: 'Side Hustle Arena', href: '/arena' },
  { label: 'Showcase', href: '/arena/showcase' },
  { label: 'Jobs', href: '/app/jobs' },
];

/**
 * Floating glass navbar. More transparent at top; slightly smaller and
 * more opaque on scroll (approved navbar motion).
 */
export function PublicNavbar() {
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
          'glass-nav mx-auto flex max-w-6xl items-center gap-6 rounded-[var(--radius-sk-xl)] transition-all duration-300',
          scrolled ? 'bg-white/90 px-3.5 py-2 shadow-sk-glass' : 'px-4 py-2.5',
        )}
        aria-label="Navigasi utama"
      >
        <BrandLogo />

        <ul className="hidden items-center gap-6 text-[13px] font-medium text-sk-body lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  'transition-colors hover:text-sk-navy',
                  isActive(link.href) && 'font-semibold text-sk-navy',
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <Link href="/login" className="text-[13px] font-semibold text-sk-navy transition-colors hover:text-sk-blue">
            Masuk
          </Link>
          <ButtonLink href="/cv-scanner" size="sm">
            Scan CV Gratis
          </ButtonLink>
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
          <div className="mt-2 flex gap-2 border-t border-sk-border pt-3">
            <ButtonLink href="/login" variant="ghost" size="sm" className="flex-1">
              Masuk
            </ButtonLink>
            <ButtonLink href="/cv-scanner" size="sm" className="flex-1">
              Scan CV Gratis
            </ButtonLink>
          </div>
        </motion.div>
      )}
    </header>
  );
}
