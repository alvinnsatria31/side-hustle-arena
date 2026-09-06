import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/cn';

/** Brand logo: blue staircase mark with Sekolah Karir text. */
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
  return (
    <Link
      href="/"
      aria-label="Sekolah Karir — beranda"
      className={cn('flex items-center gap-2.5 font-extrabold tracking-[-0.01em]', className)}
    >
      <Image
        src="/logo.png"
        alt="Sekolah Karir"
        width={36}
        height={36}
        className="h-8 w-8 shrink-0 object-contain"
        priority
      />
      {showWordmark && !compact && (
        <span className={cn('text-[15.5px]', dark ? 'text-white' : 'text-sk-navy')}>Sekolah Karir</span>
      )}
    </Link>
  );
}
