import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Brand logo: gradient "S" mark + SekolahKarir wordmark. */
export function BrandLogo({ dark, className, compact }: { dark?: boolean; className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="SekolahKarir — beranda"
      className={cn('flex items-center gap-2.5 font-extrabold tracking-[-0.01em]', className)}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sk-blue to-sk-blue-400 text-[14px] text-white"
      >
        S
      </span>
      {!compact && <span className={cn('text-[15px]', dark ? 'text-white' : 'text-sk-navy')}>SekolahKarir</span>}
    </Link>
  );
}
