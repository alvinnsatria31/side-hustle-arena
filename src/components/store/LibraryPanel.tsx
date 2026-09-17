'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ExternalLink, KeyRound } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Skeleton } from '@/components/primitives/Skeleton';
import { StateBox } from '@/components/primitives/StateBox';
import { ArenaApiError } from '@/lib/arena-client';
import { useParticipantResource } from '@/lib/participant-client';
import { deliverStoreProduct, formatIdrMinor, getStoreLibrary, type OrderSummary } from '@/lib/store-client';
import { formatNumber, formatPostedAt } from '@/lib/format';

const ORDER_BADGE: Record<OrderSummary['status'], 'blue' | 'mint' | 'amber' | 'slate'> = {
  PENDING: 'amber',
  PAID: 'blue',
  FULFILLED: 'mint',
  FAILED: 'slate',
  EXPIRED: 'slate',
  REFUNDED: 'slate',
};

const ORDER_LABEL: Record<OrderSummary['status'], string> = {
  PENDING: 'Menunggu bayar',
  PAID: 'Lunas',
  FULFILLED: 'Selesai',
  FAILED: 'Gagal',
  EXPIRED: 'Kedaluwarsa',
  REFUNDED: 'Dikembalikan',
};

/**
 * "Produk Saya".
 *
 * Two lists that answer two different questions: what do I own, and what
 * happened to my payments. They are kept apart because a buyer looking for
 * their file does not want to read a receipt, and a buyer chasing a payment
 * does not want to scroll past their library.
 */
export function LibraryPanel() {
  const library = useParticipantResource(useCallback(() => getStoreLibrary(), []));
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (slug: string) => {
    setBusy(slug);
    setError(null);
    try {
      const { delivery } = await deliverStoreProduct(slug);
      if (delivery.kind === 'ACCESS') {
        router.push(delivery.path);
        return;
      }
      /*
       * `noopener` matters on a signed URL: without it the opened tab keeps a
       * handle on this one through `window.opener`, and the URL it was given is
       * a bearer token for the file.
       */
      window.open(delivery.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Produk belum bisa dibuka. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };

  if (library.loading && !library.data) return <Skeleton className="h-64 rounded-[var(--radius-sk-2xl)]" />;
  if (library.error) {
    return (
      <StateBox
        tone="error"
        title="Produkmu belum bisa dimuat"
        description={library.error.message}
        primaryAction={{ label: 'Coba lagi', onClick: () => void library.refresh() }}
      />
    );
  }

  const owned = library.data?.owned ?? [];
  const orders = library.data?.orders ?? [];

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-[13px] text-sk-error">{error}</p>}

      <Card className="p-6">
        <PanelHeading>Produk Saya</PanelHeading>
        {owned.length === 0 ? (
          <div className="py-6 text-center">
            <p className="mb-4 text-[14px] text-sk-muted">Kamu belum punya produk digital.</p>
            <ButtonLink href="/store" size="sm">Lihat katalog</ButtonLink>
          </div>
        ) : (
          <ul className="space-y-3">
            {owned.map((item) => (
              <li key={item.entitlementId} className="flex flex-wrap items-center justify-between gap-3 border-b border-sk-border pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sk-navy">{item.title}</span>
                    <Badge variant="slate">
                      {item.productKind === 'ACCESS'
                        ? <><KeyRound size={11} aria-hidden /> Aplikasi</>
                        : <><Download size={11} aria-hidden /> Unduhan</>}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12.5px] text-sk-muted">
                    Dibeli {formatPostedAt(item.grantedAt)}
                    {item.expiresAt ? ` · akses sampai ${new Date(item.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  loading={busy === item.slug}
                  disabled={busy !== null}
                  onClick={() => void open(item.slug)}
                  iconRight={item.productKind === 'ACCESS' ? undefined : <ExternalLink size={14} aria-hidden />}
                >
                  {item.productKind === 'ACCESS' ? 'Buka aplikasi' : 'Unduh'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <PanelHeading>Riwayat Pesanan</PanelHeading>
        {orders.length === 0 ? (
          <p className="py-4 text-center text-[13.5px] text-sk-muted">Belum ada pesanan.</p>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-sk-border pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sk-navy">{order.productTitle}</span>
                    <Badge variant={ORDER_BADGE[order.status]}>{ORDER_LABEL[order.status]}</Badge>
                  </div>
                  <p className="mt-1 text-[12.5px] text-sk-muted">
                    {order.amountIdrMinor !== null
                      ? formatIdrMinor(order.amountIdrMinor)
                      : `${formatNumber(order.pointsSpent ?? 0)} poin`} · {formatPostedAt(order.createdAt)}
                  </p>
                </div>
                {order.payment && (
                  <Button size="sm" variant="ghost" onClick={() => window.open(order.payment!.redirectUrl, '_blank', 'noopener,noreferrer')}>
                    Lanjutkan pembayaran
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
