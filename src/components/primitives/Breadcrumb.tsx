import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  href?: string;
}

/** Mono breadcrumb subnav ("SEKOLAHKARIR / CV SCANNER / HASIL"). */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('font-mono text-[11px] tracking-[0.05em] text-sk-muted', className)}>
      <ol className="flex flex-wrap items-center gap-2 uppercase">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            {i > 0 && <ChevronRight size={11} aria-hidden className="opacity-60" />}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-sk-blue">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-sk-navy">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
