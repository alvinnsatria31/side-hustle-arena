'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Coins, Download, KeyRound, Wallet } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Skeleton } from '@/components/primitives/Skeleton';
import { StateBox } from '@/components/primitives/StateBox';
import { LoginModal } from '@/components/layout/LoginModal';
import { ArenaApiError } from '@/lib/arena-client';
import { useParticipantResource } from '@/lib/participant-client';
import { formatIdrMinor, getStoreProduct, loadSnap, startStoreCheckout } from '@/lib/store-client';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

type Method = 'IDR' | 'POINTS';

/**
 * One product, and the only place a purchase begins.
 *
 * The buy panel is a small state machine with four terminal shapes — not signed
 * in, already owned, not yet for sale, and buyable — and it renders exactly one.
 * Collapsing them into "a button that sometimes fails" is what produces a
 * checkout that tells a buyer "sudah dimiliki" only after they have paid.
 */
export function ProductDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const resource = useParticipantResource(useCallback(() => getStoreProduct(slug), [slug]));

  const [method, setMethod] = useState<Method | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  if (resource.loading && !resource.data) {
    return <Skeleton className="h-[420px] rounded-[var(--radius-sk-2xl)]" />;
  }
  if (resource.error) {
    const missing = resource.error instanceof ArenaApiError && resource.error.code === 'PRODUCT_NOT_FOUND';
    return (
      <StateBox
        tone={missing ? 'empty' : 'error'}
        title={missing ? 'Produk tidak ditemukan' : 'Produk belum bisa dimuat'}
        description={resource.error.message}
        primaryAction={missing ? { label: 'Lihat semua produk', href: '/store' } : { label: 'Coba lagi', onClick: () => void resource.refresh() }}
      />
    );
  }

  const product = resource.data!.product;
  const owned = resource.data!.owned;
  const comingSoon = product.status === 'COMING_SOON';
  const methods: Method[] = [
    ...(product.payWithRupiah ? (['IDR'] as const) : []),
    ...(product.payWithPoints ? (['POINTS'] as const) : []),
  ];
  const chosen = method ?? methods[0] ?? null;

  const buy = async () => {
    if (!chosen) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const { checkout } = await startStoreCheckout(slug, chosen);

      if (checkout.paymentMethod === 'POINTS') {
        setNotice('Berhasil! Produkmu sudah masuk ke halaman Produk Saya.');
        await resource.refresh();
        router.refresh();
        return;
      }

      if (!checkout.payment) {
        setError('Pembayaran belum bisa dibuka. Coba lagi sebentar lagi.');
        return;
      }
      await loadSnap(checkout.payment.clientKey, checkout.payment.environment);
      if (!window.snap) {
        // Snap's script loaded but exposed nothing — an ad blocker, usually.
        // The hosted page is the same transaction, so send them there instead
        // of stranding a payable order behind a popup that will not open.
        window.location.href = checkout.payment.redirectUrl;
        return;
      }
      window.snap.pay(checkout.payment.token, {
        onSuccess: () => {
          /*
           * Midtrans's callback is the browser's opinion, not the payment's.
           * The entitlement is granted by the webhook, so this only tells the
           * buyer where to look — it never marks anything owned by itself.
           */
          setNotice('Pembayaran diterima. Produkmu akan muncul di Produk Saya dalam beberapa detik.');
          void resource.refresh();
        },
        onPending: () => setNotice('Pembayaran sedang diproses. Kami akan mengirim notifikasi begitu lunas.'),
        onError: () => setError('Pembayaran gagal. Coba lagi atau pilih metode lain.'),
        onClose: () => setNotice((current) => current ?? 'Jendela pembayaran ditutup. Pesananmu masih bisa dilanjutkan dari halaman Produk Saya.'),
      });
    } catch (err) {
      if (err instanceof ArenaApiError && err.code === 'UNAUTHORIZED') setLoginOpen(true);
      else setError(err instanceof Error ? err.message : 'Pembelian gagal.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-sk-track px-2.5 py-1 font-mono text-[11px] font-semibold uppercase leading-none text-sk-muted">
            {product.productKind === 'ACCESS'
              ? <><KeyRound size={11} aria-hidden /> Aplikasi</>
              : <><Download size={11} aria-hidden /> Unduhan</>}
          </span>
          {owned && <Badge variant="mint"><Check size={11} aria-hidden /> Dimiliki</Badge>}
          {comingSoon && <Badge variant="amber"><Clock size={11} aria-hidden /> Segera hadir</Badge>}
        </div>

        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-sk-navy sm:text-[36px]">{product.title}</h1>
        {product.summary && <p className="mt-3 max-w-[620px] text-[15px] leading-relaxed text-sk-body">{product.summary}</p>}

        <div
          aria-hidden
          className="mt-6 aspect-[16/9] overflow-hidden rounded-[var(--radius-sk-2xl)] bg-gradient-to-br from-sk-blue-tint to-sk-track"
          style={product.coverUrl ? { backgroundImage: `url(${product.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        />

        {product.description && (
          <div className="mt-6 whitespace-pre-line text-[14.5px] leading-relaxed text-sk-body">{product.description}</div>
        )}
      </div>

      <Card className="h-fit p-6 lg:sticky lg:top-24">
        <div className="mb-4">
          <PriceHeadline product={product} comingSoon={comingSoon} />
          {product.productKind === 'ACCESS' && !comingSoon && (
            <p className="mt-1.5 text-[12.5px] text-sk-muted">
              {product.accessDurationDays
                ? `Akses berlaku ${product.accessDurationDays} hari sejak pembelian.`
                : 'Akses berlaku selamanya.'}
            </p>
          )}
        </div>

        {owned ? (
          <>
            <p className="mb-4 text-[13.5px] leading-relaxed text-sk-muted">Kamu sudah memiliki produk ini.</p>
            <ButtonLink href="/app/store" fullWidth>Buka di Produk Saya</ButtonLink>
          </>
        ) : comingSoon ? (
          <>
            <p className="mb-4 text-[13.5px] leading-relaxed text-sk-muted">
              Produk ini masih disiapkan dan belum bisa dibeli. Kami akan mengumumkannya begitu siap.
            </p>
            <Button fullWidth disabled>Segera hadir</Button>
          </>
        ) : methods.length === 0 ? (
          <>
            <p className="mb-4 text-[13.5px] leading-relaxed text-sk-muted">
              Metode pembayaran untuk produk ini belum tersedia. Coba lagi nanti.
            </p>
            <Button fullWidth disabled>Belum bisa dibeli</Button>
          </>
        ) : (
          <>
            {methods.length > 1 && (
              <div className="mb-4 space-y-2">
                {methods.map((option) => (
                  <MethodOption
                    key={option}
                    option={option}
                    selected={chosen === option}
                    label={option === 'IDR' ? formatIdrMinor(product.priceIdrMinor!) : `${formatNumber(product.pointsCost!)} poin`}
                    hint={option === 'IDR' ? 'QRIS, VA bank, e-wallet, kartu' : 'Poin dari peringkat mingguan Arena'}
                    onSelect={() => setMethod(option)}
                  />
                ))}
              </div>
            )}
            <Button fullWidth loading={pending} onClick={() => void buy()}>
              {chosen === 'POINTS' ? 'Tukar dengan poin' : 'Beli sekarang'}
            </Button>
          </>
        )}

        {error && <p role="alert" className="mt-4 text-[13px] leading-relaxed text-sk-error">{error}</p>}
        {notice && <p role="status" className="mt-4 text-[13px] leading-relaxed text-sk-navy">{notice}</p>}
      </Card>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} continueTo="/app/store" />
    </div>
  );
}

function PriceHeadline({ product, comingSoon }: { product: { priceIdrMinor: number | null; pointsCost: number | null }; comingSoon: boolean }) {
  if (comingSoon) return <p className="text-[20px] font-extrabold tracking-[-0.02em] text-sk-muted">Belum dijual</p>;
  const parts: string[] = [];
  if (product.priceIdrMinor !== null) parts.push(formatIdrMinor(product.priceIdrMinor));
  if (product.pointsCost !== null) parts.push(`${formatNumber(product.pointsCost)} poin`);
  return (
    <p className="text-[24px] font-extrabold tracking-[-0.02em] text-sk-navy">
      {parts.length ? parts.join(' atau ') : 'Gratis'}
    </p>
  );
}

function MethodOption({ option, selected, label, hint, onSelect }: {
  option: Method; selected: boolean; label: string; hint: string; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-[var(--radius-sk-xl)] border p-3 text-left transition-colors',
        selected ? 'border-sk-blue bg-sk-blue-tint/40' : 'border-sk-border hover:border-sk-blue/40',
      )}
    >
      <span className={cn('mt-0.5 shrink-0', selected ? 'text-sk-blue' : 'text-sk-muted')}>
        {option === 'IDR' ? <Wallet size={16} aria-hidden /> : <Coins size={16} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold text-sk-navy">{label}</span>
        <span className="block text-[12px] leading-snug text-sk-muted">{hint}</span>
      </span>
    </button>
  );
}
