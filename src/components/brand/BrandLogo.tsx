import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * The Sekolah Karir mark: four blue steps, the logo adopted in October 2026.
 *
 * Same path as the main site's LogoMark, so the two can never drift apart by
 * one being re-exported at a different size. Drawn inline: there is no request
 * to fail, so the navbar can never show a broken-image glyph.
 */
export function LadderMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 -12 448 448" aria-hidden focusable="false" className={className}>
      <path
        fill="#006DFE"
        d="M296 0H432A16 16 0 0 1 448 16V207A16 16 0 0 1 432 223H365V309A16 16 0 0 1 349 325H280V408A16 16 0 0 1 264 424H16A16 16 0 0 1 0 408V319A16 16 0 0 1 16 303H93V218A16 16 0 0 1 109 202H187V117A16 16 0 0 1 203 101H280V16A16 16 0 0 1 296 0Z"
      />
    </svg>
  );
}

/**
 * The mark with "Side Hustle Arena by SekolahKarir" set in the page's own type.
 *
 * Below 360px, or in compact mode, the mark stands alone so it cannot collide
 * with the navigation actions next to it.
 */
export function ArenaWordmark({
  dark,
  compact,
  className,
}: {
  dark?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LadderMark className="h-8 w-8 shrink-0" />
      {!compact && (
        <span className="flex flex-col leading-none max-[359px]:hidden">
          <span
            className={cn(
              'whitespace-nowrap text-[16px] font-extrabold tracking-[-0.03em]',
              dark ? 'text-white' : 'text-sk-navy',
            )}
          >
            Side Hustle <span className="text-[#006DFE]">Arena</span>
          </span>
          <span
            className={cn(
              'mt-1 whitespace-nowrap text-[10.5px] font-semibold',
              dark ? 'text-white/70' : 'text-sk-muted',
            )}
          >
            by <span className={dark ? 'text-white' : 'text-sk-navy'}>Sekolah</span>
            <span className="text-[#006DFE]">Karir</span>
          </span>
        </span>
      )}
    </span>
  );
}

/** Brand logo as a link home. */
export function BrandLogo({
  dark,
  className,
  compact,
  showWordmark = true,
  href = '/',
}: {
  dark?: boolean;
  className?: string;
  compact?: boolean;
  showWordmark?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Side Hustle Arena — beranda"
      className={cn('flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-sk-blue', className)}
    >
      <ArenaWordmark dark={dark} compact={compact || !showWordmark} />
    </Link>
  );
}
