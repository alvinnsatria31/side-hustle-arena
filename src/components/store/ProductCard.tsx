'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, Check, Clock, Download, KeyRound } from 'lucide-react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { Badge } from '@/components/primitives/Badge';
import { formatIdrMinor, type StoreListItem } from '@/lib/store-client';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * One product on the shelf.
 *
 * The price line carries the whole dual-currency idea in one row: rupiah, or
 * points, or both separated by "atau". A product announced but not yet for sale
 * shows its badge where the price would be, so the card never has to explain in
 * prose why there is no button.
 */
export function ProductCard({ product, owned, href }: { product: StoreListItem; owned: boolean; href: string }) {
  const reduce = useSettledReducedMotion();
  const comingSoon = product.status === 'COMING_SOON';

  return (
    <motion.article
      layout
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={reduce || comingSoon ? undefined : { y: -2 }}
      className={cn(
        'relative flex h-full flex-col gap-3 rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-4 transition-shadow duration-200',
        comingSoon ? 'border-dashed' : 'hover:border-sk-blue/40 hover:shadow-sk-md',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-sk-track px-2.5 py-1 font-mono text-[11px] font-semibold uppercase leading-none text-sk-muted">
          {product.productKind === 'ACCESS'
            ? <><KeyRound size={11} aria-hidden /> Aplikasi</>
            : <><Download size={11} aria-hidden /> Unduhan</>}
        </span>
        {owned && <Badge variant="mint"><Check size={11} aria-hidden /> Dimiliki</Badge>}
        {comingSoon && <Badge variant="amber"><Clock size={11} aria-hidden /> Segera hadir</Badge>}
      </div>

      <div
        aria-hidden
        className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-sk-xl)] bg-gradient-to-br from-sk-blue-tint to-sk-track"
        style={product.coverUrl ? { backgroundImage: `url(${product.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      />

      <h3 className="text-[16.5px] font-bold leading-snug tracking-[-0.01em] text-sk-navy">
        <Link href={href} className="after:absolute after:inset-0 after:content-['']">{product.title}</Link>
      </h3>
      {product.summary && <p className="text-[13.5px] leading-relaxed text-sk-muted">{product.summary}</p>}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <PriceLine product={product} comingSoon={comingSoon} />
        {!comingSoon && (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-sk-blue">
            Lihat <ArrowRight size={14} aria-hidden />
          </span>
        )}
      </div>
    </motion.article>
  );
}

function PriceLine({ product, comingSoon }: { product: StoreListItem; comingSoon: boolean }) {
  if (comingSoon) {
    return <span className="text-[13px] font-semibold text-sk-muted">Belum dijual</span>;
  }
  const parts: string[] = [];
  if (product.priceIdrMinor !== null) parts.push(formatIdrMinor(product.priceIdrMinor));
  if (product.pointsCost !== null) parts.push(`${formatNumber(product.pointsCost)} poin`);
  return (
    <span className="text-[15px] font-extrabold tracking-[-0.01em] text-sk-navy">
      {parts.length ? parts.join(' atau ') : 'Gratis'}
    </span>
  );
}
