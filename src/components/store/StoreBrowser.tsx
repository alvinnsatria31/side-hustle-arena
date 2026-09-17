'use client';

import { useCallback } from 'react';
import { Skeleton } from '@/components/primitives/Skeleton';
import { StateBox } from '@/components/primitives/StateBox';
import { useParticipantResource } from '@/lib/participant-client';
import { getStoreCatalog } from '@/lib/store-client';
import { ProductCard } from './ProductCard';

/**
 * The shelf, fetched in the browser.
 *
 * Client-side rather than server-rendered because the same grid is used signed
 * in and signed out, and the only difference is which cards say "Dimiliki" —
 * a fact that follows the session, not the URL. Rendering it on the server
 * would mean either a per-visitor cache or a second pass to correct it.
 */
export function StoreBrowser({ hrefPrefix = '/store' }: { hrefPrefix?: string }) {
  const catalog = useParticipantResource(useCallback(() => getStoreCatalog(), []));

  if (catalog.loading && !catalog.data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[300px] rounded-[var(--radius-sk-2xl)]" />)}
      </div>
    );
  }

  if (catalog.error) {
    return (
      <StateBox
        tone="error"
        title="Katalog belum bisa dimuat"
        description={catalog.error.message}
        primaryAction={{ label: 'Coba lagi', onClick: () => void catalog.refresh() }}
      />
    );
  }

  const items = catalog.data?.items ?? [];
  if (items.length === 0) {
    return (
      <StateBox
        tone="empty"
        title="Belum ada produk"
        description="Produk digital pertama sedang disiapkan. Cek lagi sebentar lagi, ya."
      />
    );
  }

  const owned = new Set(catalog.data?.owned ?? []);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((product) => (
        <ProductCard
          key={product.slug}
          product={product}
          owned={owned.has(product.slug)}
          href={`${hrefPrefix}/${product.slug}`}
        />
      ))}
    </div>
  );
}
