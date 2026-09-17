'use client';

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  actOnAdminStoreOrder,
  createAdminStoreProduct,
  listAdminStoreOrders,
  listAdminStoreProducts,
  saveAdminStoreProduct,
  uploadAdminStoreFile,
  useAdminResource,
  type AdminStoreOrder,
  type AdminStoreProduct,
  type AdminStoreProductInput,
} from '@/lib/admin-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Modal } from '@/components/primitives/Modal';
import { Textarea } from '@/components/primitives/Textarea';
import { ArenaApiError } from '@/lib/arena-client';

const STATUS_VARIANT: Record<string, 'blue' | 'mint' | 'amber' | 'slate'> = {
  DRAFT: 'slate',
  COMING_SOON: 'amber',
  ACTIVE: 'mint',
  ARCHIVED: 'slate',
  PENDING: 'amber',
  PAID: 'blue',
  FULFILLED: 'mint',
  FAILED: 'slate',
  EXPIRED: 'slate',
  REFUNDED: 'slate',
};

const selectClass = 'h-11 w-full rounded-[var(--radius-sk-md)] border border-sk-border bg-white px-3 text-sm';

function jakartaDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

function rupiah(minor: number | null) {
  return minor === null ? null : `Rp ${Math.round(minor / 100).toLocaleString('id-ID')}`;
}

/**
 * The form's own shape.
 *
 * Prices are edited in whole rupiah because that is what the owner types and
 * what the price tag says; the ×100 into minor units happens once, on submit.
 * Everything else is a string so an empty field is "" rather than a `null` that
 * React would treat as uncontrolled.
 */
interface FormState {
  id: string | null;
  slug: string;
  title: string;
  summary: string;
  description: string;
  productKind: 'DOWNLOAD' | 'ACCESS';
  status: 'DRAFT' | 'COMING_SOON' | 'ACTIVE' | 'ARCHIVED';
  priceIdr: string;
  pointsCost: string;
  coverUrl: string;
  deliveryKind: '' | 'LINK' | 'FILE';
  deliveryUrl: string;
  deliveryObjectKey: string;
  deliveryFilename: string;
  featureKey: string;
  accessDurationDays: string;
  sortOrder: string;
}

const emptyForm: FormState = {
  id: null, slug: '', title: '', summary: '', description: '',
  productKind: 'DOWNLOAD', status: 'DRAFT',
  priceIdr: '', pointsCost: '', coverUrl: '',
  deliveryKind: '', deliveryUrl: '', deliveryObjectKey: '', deliveryFilename: '',
  featureKey: '', accessDurationDays: '', sortOrder: '0',
};

function toForm(product: AdminStoreProduct): FormState {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    summary: product.summary ?? '',
    description: product.description ?? '',
    productKind: product.productKind,
    status: product.status,
    priceIdr: product.priceIdrMinor === null ? '' : String(Math.round(product.priceIdrMinor / 100)),
    pointsCost: product.pointsCost === null ? '' : String(product.pointsCost),
    coverUrl: product.coverUrl ?? '',
    deliveryKind: product.deliveryKind ?? '',
    deliveryUrl: product.deliveryUrl ?? '',
    deliveryObjectKey: product.deliveryObjectKey ?? '',
    deliveryFilename: product.deliveryFilename ?? '',
    featureKey: product.featureKey ?? '',
    accessDurationDays: product.accessDurationDays === null ? '' : String(product.accessDurationDays),
    sortOrder: String(product.sortOrder),
  };
}

function toPayload(form: FormState): AdminStoreProductInput {
  const number = (value: string) => (value.trim() === '' ? null : Number(value));
  const price = number(form.priceIdr);
  return {
    slug: form.slug,
    title: form.title,
    summary: form.summary || null,
    description: form.description || null,
    productKind: form.productKind,
    status: form.status,
    priceIdrMinor: price === null ? null : Math.round(price * 100),
    pointsCost: number(form.pointsCost),
    coverUrl: form.coverUrl || null,
    deliveryKind: form.productKind === 'ACCESS' || form.deliveryKind === '' ? null : form.deliveryKind,
    deliveryUrl: form.deliveryUrl || null,
    deliveryObjectKey: form.deliveryObjectKey || null,
    deliveryFilename: form.deliveryFilename || null,
    featureKey: form.featureKey || null,
    accessDurationDays: number(form.accessDurationDays),
    sortOrder: Number(form.sortOrder) || 0,
  };
}

function ProductsPanel() {
  const products = useAdminResource(useCallback(() => listAdminStoreProducts(), []));
  const [form, setForm] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const submit = async () => {
    if (!form) return;
    setPending(true);
    setError(null);
    try {
      if (form.id) await saveAdminStoreProduct(form.id, toPayload(form));
      else await createAdminStoreProduct(toPayload(form));
      setForm(null);
      await products.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Menyimpan produk gagal.');
    } finally {
      setPending(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { storageKey, filename } = await uploadAdminStoreFile(file);
      setForm((current) => current && { ...current, deliveryKind: 'FILE', deliveryObjectKey: storageKey, deliveryFilename: filename, deliveryUrl: '' });
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Unggah berkas gagal.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PanelHeading className="mb-0">Katalog Produk</PanelHeading>
        <Button size="sm" iconLeft={<Plus size={15} aria-hidden />} onClick={() => { setForm({ ...emptyForm }); setError(null); }}>
          Produk baru
        </Button>
      </div>

      {products.error && <p className="mb-4 text-sm text-sk-error">{products.error.message}</p>}

      <div className="space-y-3">
        {products.data?.map((product) => (
          <div key={product.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-sk-border pb-3 last:border-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sk-navy">{product.title}</span>
                <Badge variant={STATUS_VARIANT[product.status]}>{product.status}</Badge>
                <Badge variant="slate">{product.productKind}</Badge>
              </div>
              <p className="mt-1 font-mono text-[11.5px] text-sk-muted">{product.slug}</p>
              <p className="mt-1 text-sm text-sk-body">
                {[rupiah(product.priceIdrMinor), product.pointsCost === null ? null : `${product.pointsCost} poin`]
                  .filter(Boolean).join(' · ') || 'Belum ada harga'}
              </p>
              <p className="mt-1 break-all text-xs text-sk-muted">
                {product.productKind === 'ACCESS'
                  ? (product.featureKey ? `Feature key: ${product.featureKey}` : 'Feature key belum diisi — belum bisa diaktifkan.')
                  : product.deliveryKind === 'LINK' ? `Link: ${product.deliveryUrl}`
                  : product.deliveryKind === 'FILE' ? `Berkas: ${product.deliveryFilename ?? product.deliveryObjectKey}`
                  : 'Pengiriman belum diatur — belum bisa diaktifkan.'}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setForm(toForm(product)); setError(null); }}>Ubah</Button>
          </div>
        ))}
        {products.data?.length === 0 && !products.loading && (
          <p className="py-6 text-center text-sm text-sk-muted">Belum ada produk. Mulai dari &ldquo;Produk baru&rdquo;.</p>
        )}
      </div>

      <Modal open={form !== null} onClose={() => setForm(null)} labelledBy="store-product-title" className="max-w-2xl">
        <div className="max-h-[80vh] overflow-y-auto p-7">
          <h3 id="store-product-title" className="mb-1 text-lg font-bold text-sk-navy">
            {form?.id ? 'Ubah produk' : 'Produk baru'}
          </h3>
          <p className="mb-5 text-sm text-sk-muted">
            Simpan sebagai DRAFT kapan saja. Status ACTIVE baru diizinkan kalau harga dan cara pengirimannya sudah lengkap.
          </p>

          {form && (
            <div className="space-y-4">
              <Field label="Judul">
                <Input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={160} />
              </Field>
              <Field label="Slug" hint="Dipakai di URL: /store/<slug>. Huruf kecil, angka, tanda hubung.">
                <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} maxLength={64} />
              </Field>
              <Field label="Ringkasan" hint="Satu baris yang tampil di kartu katalog.">
                <Input value={form.summary} onChange={(e) => set('summary', e.target.value)} maxLength={300} />
              </Field>
              <Field label="Deskripsi">
                <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={5} maxLength={8000} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jenis">
                  <select className={selectClass} value={form.productKind} onChange={(e) => set('productKind', e.target.value as FormState['productKind'])}>
                    <option value="DOWNLOAD">DOWNLOAD — berkas atau link</option>
                    <option value="ACCESS">ACCESS — buka fitur di dalam platform</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select className={selectClass} value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])}>
                    <option value="DRAFT">DRAFT — tersembunyi</option>
                    <option value="COMING_SOON">COMING_SOON — tampil, belum bisa dibeli</option>
                    <option value="ACTIVE">ACTIVE — dijual</option>
                    <option value="ARCHIVED">ARCHIVED — ditarik</option>
                  </select>
                </Field>
                <Field label="Harga Rupiah" hint="Rupiah penuh, tanpa sen. Kosongkan kalau tidak dijual dengan uang.">
                  <Input type="number" min={0} step={1000} value={form.priceIdr} onChange={(e) => set('priceIdr', e.target.value)} />
                </Field>
                <Field label="Harga poin" hint="Kosongkan kalau tidak bisa ditukar poin.">
                  <Input type="number" min={0} step={50} value={form.pointsCost} onChange={(e) => set('pointsCost', e.target.value)} />
                </Field>
              </div>

              {form.productKind === 'ACCESS' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Feature key" hint="Harus terdaftar di featurePaths, mis. app-360.">
                    <Input value={form.featureKey} onChange={(e) => set('featureKey', e.target.value)} maxLength={64} />
                  </Field>
                  <Field label="Durasi akses (hari)" hint="Kosongkan untuk akses selamanya.">
                    <Input type="number" min={1} value={form.accessDurationDays} onChange={(e) => set('accessDurationDays', e.target.value)} />
                  </Field>
                </div>
              ) : (
                <>
                  <Field label="Cara pengiriman">
                    <select className={selectClass} value={form.deliveryKind} onChange={(e) => set('deliveryKind', e.target.value as FormState['deliveryKind'])}>
                      <option value="">Belum diatur</option>
                      <option value="LINK">LINK — Notion, Drive, halaman lain</option>
                      <option value="FILE">FILE — berkas yang diunggah ke storage</option>
                    </select>
                  </Field>
                  {form.deliveryKind === 'LINK' && (
                    <Field label="Alamat tujuan" hint="Harus https.">
                      <Input type="url" placeholder="https://..." value={form.deliveryUrl} onChange={(e) => set('deliveryUrl', e.target.value)} />
                    </Field>
                  )}
                  {form.deliveryKind === 'FILE' && (
                    <Field label="Berkas produk" hint={form.deliveryObjectKey ? `Tersimpan: ${form.deliveryFilename || form.deliveryObjectKey}` : 'Belum ada berkas.'}>
                      <input
                        type="file"
                        className="block w-full text-sm text-sk-body file:mr-3 file:rounded-md file:border-0 file:bg-sk-blue-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sk-blue"
                        onChange={(e) => void upload(e.target.files?.[0])}
                        disabled={uploading}
                      />
                    </Field>
                  )}
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cover (URL)" hint="https atau path lokal yang diawali /.">
                  <Input value={form.coverUrl} onChange={(e) => set('coverUrl', e.target.value)} maxLength={500} />
                </Field>
                <Field label="Urutan tampil">
                  <Input type="number" min={0} value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {error && <p role="alert" className="mt-4 text-sm text-sk-error">{error}</p>}
          {uploading && <p role="status" className="mt-4 text-sm text-sk-muted">Mengunggah berkas…</p>}

          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setForm(null)} disabled={pending}>Batal</Button>
            <Button onClick={() => void submit()} loading={pending} disabled={uploading}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] leading-snug text-sk-muted">{hint}</span>}
    </label>
  );
}

const ORDER_STATUSES = ['', 'PENDING', 'PAID', 'FULFILLED', 'FAILED', 'EXPIRED', 'REFUNDED'] as const;

function OrdersPanel() {
  const [status, setStatus] = useState<(typeof ORDER_STATUSES)[number]>('');
  const loader = useCallback(() => listAdminStoreOrders({ status: status || undefined, limit: 50 }), [status]);
  const orders = useAdminResource(loader);

  const [action, setAction] = useState<{ kind: 'fulfill' | 'refund' | 'cancel'; row: AdminStoreOrder } | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!action) return;
    if (!reason.trim()) { setError('Alasan wajib diisi.'); return; }
    setPending(true);
    setError(null);
    try {
      await actOnAdminStoreOrder(action.row.id, action.kind, reason);
      setAction(null);
      setReason('');
      await orders.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Aksi gagal.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PanelHeading className="mb-0">Pesanan</PanelHeading>
        <select aria-label="Filter status pesanan" value={status} onChange={(e) => setStatus(e.target.value as (typeof ORDER_STATUSES)[number])} className="h-9 rounded-md border border-sk-border bg-white px-3 text-sm">
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s || 'Semua status'}</option>)}
        </select>
      </div>

      {orders.error && <p className="mb-4 text-sm text-sk-error">{orders.error.message}</p>}

      <div className="space-y-3">
        {orders.data?.map((row) => (
          <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-sk-border pb-3 last:border-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sk-navy">{row.productTitle}</span>
                <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                <Badge variant="slate">{row.paymentMethod}</Badge>
              </div>
              <p className="mt-1 text-sm text-sk-body">
                {row.buyer ?? row.buyerEmail ?? 'Pembeli'} · {row.amountIdrMinor !== null ? rupiah(row.amountIdrMinor) : `${row.pointsSpent} poin`} · {jakartaDate(row.createdAt)}
              </p>
              {row.providerOrderId && <p className="mt-1 break-all font-mono text-[11px] text-sk-muted">{row.providerOrderId}{row.providerStatus ? ` · ${row.providerStatus}` : ''}</p>}
              {row.failureReason && <p className="mt-1 text-xs text-sk-muted">{row.failureReason}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {(row.status === 'PENDING' || row.status === 'PAID') && (
                <Button size="sm" onClick={() => { setAction({ kind: 'fulfill', row }); setReason(''); setError(null); }}>Tandai lunas</Button>
              )}
              {row.status === 'PENDING' && (
                <Button size="sm" variant="ghost" onClick={() => { setAction({ kind: 'cancel', row }); setReason(''); setError(null); }}>Batalkan</Button>
              )}
              {row.status === 'FULFILLED' && row.paymentMethod === 'POINTS' && (
                <Button size="sm" variant="ghost" onClick={() => { setAction({ kind: 'refund', row }); setReason(''); setError(null); }}>Kembalikan poin</Button>
              )}
            </div>
          </div>
        ))}
        {orders.data?.length === 0 && !orders.loading && (
          <p className="py-6 text-center text-sm text-sk-muted">Tidak ada pesanan dengan status ini.</p>
        )}
      </div>

      <Modal open={action !== null} onClose={() => setAction(null)} labelledBy="store-order-action">
        <div className="p-7">
          <h3 id="store-order-action" className="mb-2 text-lg font-bold text-sk-navy">
            {action?.kind === 'fulfill' ? 'Tandai pesanan ini lunas'
              : action?.kind === 'refund' ? 'Kembalikan poin pembeli'
              : 'Batalkan pesanan ini'}
          </h3>
          <p className="mb-4 text-sm text-sk-muted">
            {action?.kind === 'fulfill'
              ? 'Pakai ini hanya kalau pembayaran sudah dipastikan masuk di dashboard Midtrans tapi notifikasinya tidak sampai. Produk langsung diserahkan ke pembeli.'
              : action?.kind === 'refund'
                ? 'Poin dikembalikan ke saldo pembeli dan kepemilikan produknya dicabut. Pesanan Rupiah harus direfund lewat dashboard Midtrans.'
                : 'Pesanan ditutup supaya pembeli bisa mencoba lagi. Tidak ada uang yang ditarik atau dikembalikan.'}
          </p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} placeholder="Alasan / referensi" className="mb-4" />
          {error && <p className="mb-4 text-sm text-sk-error">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setAction(null)} disabled={pending}>Batal</Button>
            <Button variant={action?.kind === 'fulfill' ? 'primary' : 'destructive'} onClick={() => void submit()} loading={pending}>Konfirmasi</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

export function AdminStoreConsole() {
  return (
    <AdminShell
      title="Toko Digital"
      description="Katalog produk digital dan pesanannya. Produk baru mulai sebagai DRAFT — isi harga dan cara pengirimannya, lalu ubah statusnya ke ACTIVE saat siap dijual."
    >
      <div className="space-y-6">
        <ProductsPanel />
        <OrdersPanel />
      </div>
    </AdminShell>
  );
}
