'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Bookmark, Check, Clock, Coins, Download, KeyRound, LayoutGrid, PackageOpen } from 'lucide-react';
import { FOLDER_LIFT, FOLDER_WRAP, FolderSheets } from '@/components/motion/FolderStack';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { getStoreCatalog, type StoreListItem } from '@/lib/store-client';
import { useParticipantResource } from '@/lib/participant-client';
import { formatPoints } from '@/lib/reward-progress';
import { cn } from '@/lib/cn';

type Filter = 'all' | StoreListItem['productKind'];

const FILTERS: Array<{ value: Filter; label: string; icon: typeof LayoutGrid }> = [
  { value: 'all', label: 'Semua', icon: LayoutGrid },
  { value: 'DOWNLOAD', label: 'Unduhan', icon: Download },
  { value: 'ACCESS', label: 'Akses & kelas', icon: KeyRound },
];

const SAVED_KEY = 'arena:saved-rewards';

function readSaved(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** A per-browser wishlist; storage can be missing or blocked, so every access is guarded. */
function useSavedRewards() {
  const [saved, setSaved] = useState<string[]>(readSaved);
  const toggle = useCallback((slug: string) => {
    setSaved((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
      try {
        window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  return { saved, toggle };
}

function CatalogCard({
  item,
  owned,
  saved,
  balance,
  index,
  onToggleSave,
}: {
  item: StoreListItem;
  owned: boolean;
  saved: boolean;
  balance: number;
  index: number;
  onToggleSave: () => void;
}) {
  const reduce = useSettledReducedMotion();
  const comingSoon = item.status === 'COMING_SOON';
  const cost = item.pointsCost ?? 0;
  const short = Math.max(0, cost - balance);
  const href = `/store/${encodeURIComponent(item.slug)}`;
  const KindIcon = item.productKind === 'ACCESS' ? KeyRound : Download;

  return (
    <motion.li
      className={FOLDER_WRAP}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-48px' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.05, 0.25) }}
    >
      <FolderSheets tone="violet" />
      <article
        className={cn(
          'flex flex-col gap-3 rounded-[var(--radius-sk-2xl)] border bg-white p-3.5',
          FOLDER_LIFT,
          comingSoon ? 'border-dashed border-sk-border' : 'border-sk-border shadow-sm group-hover:border-sk-violet/40',
        )}
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-sk-xl)] bg-[linear-gradient(135deg,#f1ecff_0%,#e4efff_100%)]">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.05]"
            />
          ) : (
            <span aria-hidden className="grid h-full w-full place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/80 text-sk-violet shadow-sk-xs transition-transform duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-6">
                <KindIcon size={24} strokeWidth={2.1} />
              </span>
            </span>
          )}
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-sk-violet-700 shadow-sk-xs">
            <KindIcon size={11} aria-hidden /> {item.productKind === 'ACCESS' ? 'Akses' : 'Unduhan'}
          </span>
          {owned && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-sk-success px-2 py-1 font-mono text-[10px] font-bold text-white">
              <Check size={11} aria-hidden /> Dimiliki
            </span>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug tracking-[-0.01em] text-sk-navy">{item.title}</h3>
          {item.summary && <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-sk-muted">{item.summary}</p>}
        </div>

        <p className="mt-auto flex items-center gap-1.5 font-mono text-[14px] font-bold tabular-nums text-sk-warning-ink">
          <Coins size={15} aria-hidden /> {formatPoints(cost)} poin
        </p>

        <div className="flex items-center gap-2">
          {comingSoon ? (
            <span className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sk-md)] bg-sk-track text-[13px] font-bold text-sk-muted">
              <Clock size={14} aria-hidden /> Segera hadir
            </span>
          ) : (
            <Link
              href={href}
              className={cn(
                'group/cta inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sk-md)] text-[13px] font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue',
                owned
                  ? 'bg-sk-success-tint text-sk-success hover:bg-sk-success/15'
                  : short > 0
                    ? 'border border-sk-border bg-white text-sk-muted hover:border-sk-violet/40 hover:text-sk-violet-700'
                    : 'bg-[linear-gradient(90deg,#6d4de0,#8a6bfc)] text-white shadow-[0_8px_18px_-8px_rgba(109,77,224,0.8)] hover:-translate-y-px active:scale-[0.98]',
              )}
            >
              {owned ? 'Buka produk' : short > 0 ? `Kurang ${formatPoints(short)} poin` : 'Tukar poin'}
            </Link>
          )}
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            aria-label={saved ? `Hapus ${item.title} dari simpanan` : `Simpan ${item.title}`}
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-sk-md)] border transition-all duration-200 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue',
              saved ? 'border-sk-violet/40 bg-sk-violet-tint text-sk-violet-700' : 'border-sk-border bg-white text-sk-muted hover:text-sk-navy',
            )}
          >
            <Bookmark size={16} aria-hidden fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </article>
    </motion.li>
  );
}

/**
 * Katalog hadiah — everything else points can buy, beside the ladder.
 *
 * The ladder's rewards unlock once each; this shelf is the store's
 * points-priced products, bought as often as the balance allows through the
 * store's own checkout (the "Tukar poin" button opens the product page, where
 * the points payment already lives). A product announced but not on sale shows
 * "Segera hadir" instead of a button that could only fail.
 */
export function RewardCatalog({ balance }: { balance: number }) {
  const catalog = useParticipantResource(useCallback(() => getStoreCatalog(), []));
  const [filter, setFilter] = useState<Filter>('all');
  const { saved, toggle } = useSavedRewards();
  const items = useMemo(() => (catalog.data?.items ?? []).filter((item) => item.pointsCost !== null), [catalog.data]);
  const owned = useMemo(() => new Set(catalog.data?.owned ?? []), [catalog.data]);
  const visible = items.filter((item) => filter === 'all' || item.productKind === filter);

  if (catalog.loading && !catalog.data) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[320px] rounded-[var(--radius-sk-2xl)]" />)}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--radius-sk-2xl)] border border-dashed border-sk-border bg-white px-6 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-sk-violet-tint text-sk-violet"><PackageOpen size={22} aria-hidden /></span>
        <p className="text-[15px] font-bold text-sk-navy">Katalog penukaran poin sedang disiapkan.</p>
        <p className="max-w-md text-[13px] leading-relaxed text-sk-muted">
          Poinmu tetap aman. Begitu katalog dibuka, poin bisa ditukar dengan produk digital dan hadiah lain di sini.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div role="group" aria-label="Filter katalog" className="no-scrollbar -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map(({ value, label, icon: Icon }) => {
          const active = filter === value;
          const count = value === 'all' ? items.length : items.filter((item) => item.productKind === value).length;
          if (value !== 'all' && count === 0) return null;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(value)}
              className={cn(
                'relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue',
                active ? 'border-transparent text-white' : 'border-sk-border bg-white text-sk-body hover:border-sk-blue/40 hover:text-sk-navy',
              )}
            >
              {active && (
                <motion.span layoutId="catalog-filter" className="absolute inset-0 rounded-full bg-sk-blue" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
              )}
              <Icon size={15} aria-hidden className="relative" />
              <span className="relative">{label}</span>
              <span className={cn('relative font-mono text-[10.5px]', active ? 'text-white/70' : 'text-sk-faint')}>{count}</span>
            </button>
          );
        })}
      </div>
      <ul className="grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((item, index) => (
          <CatalogCard
            key={item.slug}
            item={item}
            index={index}
            balance={balance}
            owned={owned.has(item.slug)}
            saved={saved.includes(item.slug)}
            onToggleSave={() => toggle(item.slug)}
          />
        ))}
      </ul>
    </div>
  );
}
