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
 * Brand logo: SekolahKarir Arena official logo.
 *
 * Served unoptimized and with priority since it sits above the fold on all
 * key layout surfaces. On ultra-narrow screens (< 360px) or in compact mode,
 * the mark is displayed alone to prevent overlapping adjacent navigation actions.
 */
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
  const [failed, setFailed] = useState(false);

  return (
    <Link
      href={href}
      aria-label="SekolahKarir Arena — beranda"
      className={cn('flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-sk-blue', className)}
    >
      {failed ? (
        <div className="flex items-center gap-2">
          <StaircaseMark className="h-8 w-8 shrink-0 text-[#026bf4]" />
          {showWordmark && !compact && (
            <span className={cn('whitespace-nowrap font-extrabold text-[15.5px] leading-none', dark ? 'text-white' : 'text-sk-navy')}>
              SekolahKarir <span className="text-[#026bf4]">Arena</span>
            </span>
          )}
        </div>
      ) : compact || !showWordmark ? (
        <Image
          src="/logo-mark.png"
          alt="SekolahKarir Arena"
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 object-contain"
          priority
          unoptimized
          onError={() => setFailed(true)}
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailed(true);
          }}
        />
      ) : (
        <>
          <Image
            src="/logo.png"
            alt="SekolahKarir Arena"
            width={200}
            height={32}
            className={cn('h-8 w-auto object-contain', 'max-[359px]:hidden')}
            priority
            unoptimized
            onError={() => setFailed(true)}
            ref={(img) => {
              if (img?.complete && img.naturalWidth === 0) setFailed(true);
            }}
          />
          <Image
            src="/logo-mark.png"
            alt="SekolahKarir Arena"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 object-contain min-[360px]:hidden"
            priority
            unoptimized
          />
        </>
      )}
    </Link>
  );
}
