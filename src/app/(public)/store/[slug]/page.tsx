import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { ProductDetail } from '@/components/store/ProductDetail';
import { isStoreEnabled } from '@/server/store/config';
import { getStoreProduct } from '@/server/store/catalog-service';

export const dynamic = 'force-dynamic';

/**
 * The title and description are read on the server even though the page body
 * fetches again in the browser: a product shared in a WhatsApp group should
 * unfurl as its own name, not as "Produk Digital". A product that is not on the
 * shelf has no metadata to leak, so the lookup failing is simply a 404.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!isStoreEnabled()) return { title: 'Produk Digital' };
  const { slug } = await params;
  try {
    const product = await getStoreProduct(slug);
    return { title: product.title, description: product.summary ?? undefined };
  } catch {
    return { title: 'Produk Digital' };
  }
}

export default async function StoreProductPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isStoreEnabled()) notFound();
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-28 md:pt-32">
      <Breadcrumb items={[{ label: 'Produk Digital', href: '/store' }, { label: 'Detail' }]} />
      <div className="mt-7">
        <ProductDetail slug={slug} />
      </div>
    </div>
  );
}
