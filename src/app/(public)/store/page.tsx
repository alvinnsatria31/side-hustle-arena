import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Entrance } from '@/components/motion/Reveal';
import { StoreBrowser } from '@/components/store/StoreBrowser';
import { isStoreEnabled } from '@/server/store/config';

export const metadata = { title: 'Produk Digital' };
export const dynamic = 'force-dynamic';

/**
 * The shop front, open to everyone.
 *
 * Public rather than behind `/app` because a catalogue nobody can see before
 * signing up sells nothing — the sign-in wall belongs at checkout, which is
 * where the buyer actually needs an account to own anything.
 */
export default function StorePage() {
  if (!isStoreEnabled()) notFound();
  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-28 md:pt-32">
      <Breadcrumb items={[{ label: 'Produk Digital' }]} />
      <Entrance className="mb-8 mt-7">
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[36px]">Produk Digital</h1>
        <p className="mt-2 max-w-[620px] text-[14px] leading-relaxed text-sk-muted">
          Template, panduan, dan aplikasi karier yang bisa langsung kamu pakai. Bayar dengan Rupiah, atau tukar dengan
          poin yang kamu kumpulkan di Side Hustle Arena.
        </p>
      </Entrance>
      <StoreBrowser />
    </div>
  );
}
