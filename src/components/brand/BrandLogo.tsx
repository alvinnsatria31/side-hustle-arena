'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * The staircase mark, drawn inline so it needs no request at all.
 *
 * It stands in whenever /logo.png cannot be shown — a blocked or failed
 * request, a proxy that strips static files, an offline shell — so the navbar
 * never shows a broken-image glyph or an empty corner where the brand belongs.
 */
function StaircaseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden focusable="false" className={className}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M8 23.5h5.5V18H19v-5.5h5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Brand logo: blue staircase mark with the Sekolah Karir wordmark.
 *
 * The image is served as-is (`unoptimized`): it is a 96×96 PNG of 11 KB, so
 * the optimizer adds a server round-trip and a failure mode without saving
 * anything. `priority` keeps it out of lazy loading, since it is always above
 * the fold. The wordmark never wraps and hides only on very narrow screens
 * (< 360px), where the mark alone keeps the navbar from overlapping its icons.
 */
export function BrandLogo({
  dark,
  className,
  compact,
  showWordmark = true,
}: {
  dark?: boolean;
  className?: string;
  compact?: boolean;
  showWordmark?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Link
      href="/"
      aria-label="Sekolah Karir — beranda"
      className={cn('flex shrink-0 items-center gap-2.5 font-extrabold tracking-[-0.01em]', className)}
    >
      {failed ? (
        <StaircaseMark className="h-8 w-8 shrink-0 text-sk-blue" />
      ) : (
        <Image
          src="/logo.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 object-contain"
          priority
          unoptimized
          onError={() => setFailed(true)}
          // An error that fired before hydration never reaches onError; a
          // completed image with no pixels is that case, caught on mount.
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailed(true);
          }}
        />
      )}
      {showWordmark && !compact && (
        <span className={cn('whitespace-nowrap text-[15.5px] leading-none max-[359px]:hidden', dark ? 'text-white' : 'text-sk-navy')}>
          Sekolah Karir
        </span>
      )}
    </Link>
  );
}
