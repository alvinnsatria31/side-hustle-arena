'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ButtonLink } from '@/components/primitives/Button';
import { ARENA_ENTRY_LABEL, arenaEntryHref } from '@/components/landing/arena-entry';
import { cn } from '@/lib/cn';

/**
 * The landing page's own header.
 *
 * Deliberately not `PublicNavbar`. That bar lists the Arena's internal
 * surfaces — projects, judging, showcase, rewards — which is right for someone
 * already inside the product and wrong for the one screen whose whole job is
 * to get a stranger through a single door. Every extra link here is a way to
 * leave without ever seeing the Arena.
 *
 * So: where this sits in the Sekolah Karir family, where to get help, and one
 * button. Career is named because people ask what else exists, and carries no
 * link because it is not deployed — a link to nothing reads as a broken site.
 */
export function LandingHeader({ signedIn, mainSiteUrl }: { signedIn: boolean; mainSiteUrl: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduce = useReducedMotion();
  const entryHref = arenaEntryHref(signedIn);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A hash link inside the page leaves the sheet open over the section it just
  // scrolled to. Close on any navigation intent instead of on route change,
  // which never fires for `#kontak`.
  const closeMenu = () => setMenuOpen(false);

  const careerChip = (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-sk-border bg-white/70 px-3 py-1.5 text-[12.5px] font-medium text-sk-muted"
      title="Sekolah Karir Career belum tersedia untuk publik"
    >
      <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-sk-warning" />
      Sekolah Karir Career
      <span aria-hidden className="text-sk-faint">·</span>
      <span className="font-semibold text-sk-warning-ink">Segera hadir</span>
    </span>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <motion.nav
        layout
        transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
        className={cn(
          'glass-nav mx-auto flex max-w-6xl items-center gap-4 rounded-[var(--radius-sk-xl)] transition-all duration-300',
          'lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-8',
          scrolled ? 'bg-white/90 px-3.5 py-2 shadow-sk-glass' : 'px-4 py-2.5 lg:px-6 lg:py-3',
        )}
        aria-label="Navigasi utama"
      >
        {/* The mark is a 32px image, which leaves the brand link under the
            44px target the rest of the site holds itself to. Padded here
            rather than in BrandLogo, which sits in headers with their own
            spacing. */}
        <BrandLogo className="py-1.5" />

        <div className="hidden items-center justify-center gap-5 lg:flex xl:gap-7">
          <a
            href={mainSiteUrl}
            className="whitespace-nowrap text-[13px] font-medium text-sk-body transition-colors hover:text-sk-navy"
          >
            Sekolah Karir
          </a>
          {careerChip}
          <a
            href="#kontak"
            className="whitespace-nowrap text-[13px] font-medium text-sk-body transition-colors hover:text-sk-navy"
          >
            Kontak
          </a>
        </div>

        <div className="ml-auto hidden items-center justify-end lg:ml-0 lg:flex">
          <ButtonLink href={entryHref} size="sm" className="rounded-full">
            {ARENA_ENTRY_LABEL}
          </ButtonLink>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <ButtonLink href={entryHref} size="sm" className="rounded-full">
            {ARENA_ENTRY_LABEL}
          </ButtonLink>
          <button
            type="button"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[var(--radius-sk-md)] text-sk-navy transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </motion.nav>

      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
          /* Solid, not glass: this sheet lies over the hero headline, and a
             72%-white panel lets the type behind it read through the links. */
          className="mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-3 shadow-sk-lg lg:hidden"
        >
          <a
            href={mainSiteUrl}
            onClick={closeMenu}
            className="flex min-h-[44px] items-center rounded-[var(--radius-sk-md)] px-3 text-[14px] font-medium text-sk-body transition-colors hover:bg-sk-bg hover:text-sk-navy"
          >
            Sekolah Karir
          </a>
          <a
            href="#kontak"
            onClick={closeMenu}
            className="flex min-h-[44px] items-center rounded-[var(--radius-sk-md)] px-3 text-[14px] font-medium text-sk-body transition-colors hover:bg-sk-bg hover:text-sk-navy"
          >
            Kontak
          </a>
          <div className="flex min-h-[44px] items-center px-3">{careerChip}</div>
        </motion.div>
      )}
    </header>
  );
}
