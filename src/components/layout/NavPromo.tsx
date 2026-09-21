import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { NavLink as NavLinkEntry } from '@/components/layout/nav-links';
import { cn } from '@/lib/cn';

/**
 * The promo treatment a highlighted nav entry gets, in one place.
 *
 * Five surfaces render the shared link list — the public bar, its mobile
 * sheet, the app bar, the app's small-screen menu and the footer. A pill
 * hand-written into each of them is a pill that drifts: the last time a link
 * was added to only some of them, the site advertised a route on one surface
 * and hid it on another, which is why `nav-links.ts` exists at all. The same
 * reasoning applies to how a link looks, not just whether it is there.
 */

/**
 * Gradient pill shared by every highlighted entry.
 *
 * Violet, not the brand blue, and that is the whole point. Blue already means
 * two things in this navigation: the primary call to action in the public bar
 * and the current page in the sidebar rail. A blue promo pill sat beside an
 * active blue rail item and read as a second "you are here" — the one thing a
 * nav must never be ambiguous about. Violet is already in the palette, says
 * "a different product" rather than "your position", and clears 4.5:1 against
 * white at both gradient stops.
 *
 * The app bar is the exception: its current page is marked by an underline,
 * not a blue fill, so its Tools button is solid brand blue (TOOLS_BUTTON).
 */
export const PROMO_PILL =
  'bg-gradient-to-r from-sk-violet-700 to-sk-violet-600 text-white shadow-[0_6px_16px_-6px_rgba(109,77,224,0.65)] hover:from-sk-violet-700 hover:to-sk-violet-700';

export const TOOLS_BUTTON =
  'bg-sk-blue text-white shadow-[0_8px_18px_-8px_rgba(36,107,253,0.7)] hover:bg-sk-blue-700 hover:-translate-y-px';

/**
 * The "BARU" flag.
 *
 * Mono and uppercase like every other micro-label in the system, and sized so
 * it reads as a tag on the link rather than as a second word in it. Its ink
 * follows the pill it sits on: violet on the promo gradient, blue on the app
 * bar's blue Tools button.
 */
export function NewBadge({ className, tone = 'violet' }: { className?: string; tone?: 'violet' | 'blue' }) {
  return (
    <span
      className={cn(
        'rounded-full bg-white px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase leading-none tracking-[0.1em]',
        tone === 'blue' ? 'text-sk-blue-700' : 'text-sk-violet-700',
        className,
      )}
    >
      Baru
    </span>
  );
}

/**
 * A nav entry that may point off-site.
 *
 * `next/link` prefetches and client-navigates, neither of which means anything
 * for an absolute URL on another host, so an external entry renders as a plain
 * anchor. The new-tab hint is spoken as well as drawn: an icon alone tells a
 * screen-reader user nothing about where the link is about to put them.
 */
export function NavAnchor({
  link,
  className,
  children,
  onClick,
  ...rest
}: {
  link: NavLinkEntry;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick' | 'className'>) {
  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
        {...rest}
      >
        {children}
        <span className="sr-only">(buka di tab baru)</span>
      </a>
    );
  }
  return (
    <Link href={link.href} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

/** The arrow that marks an entry as leaving the site. */
export function ExternalMark({ className }: { className?: string }) {
  return <ArrowUpRight size={13} aria-hidden className={cn('flex-none opacity-80', className)} />;
}
