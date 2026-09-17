import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/primitives/Button';
import { LibraryPanel } from '@/components/store/LibraryPanel';
import { isStoreEnabled } from '@/server/store/config';

export const metadata = { title: 'Produk Saya' };
export const dynamic = 'force-dynamic';

/** What this participant owns. Browsing and buying live on the public `/store`. */
export default function AppStorePage() {
  if (!isStoreEnabled()) notFound();
  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-sk-navy">Produk Saya</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-sk-muted">
            Semua produk digital yang kamu beli, siap diunduh atau dibuka kapan saja.
          </p>
        </div>
        <ButtonLink href="/store" variant="ghost" size="sm">Lihat katalog</ButtonLink>
      </div>
      <LibraryPanel />
    </div>
  );
}
