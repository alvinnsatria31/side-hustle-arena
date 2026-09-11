'use client';

import { useCallback, useState } from 'react';
import {
  fulfillAdminRedemption,
  getAdminInventory,
  listAdminRedemptionsClient,
  pushAdminVoucher,
  retryAdminVoucherVoid,
  reverseAdminRedemption,
  setAdminInventoryQuantity,
  setAdminRewardActive,
  useAdminResource,
  type AdminRedemption,
} from '@/lib/admin-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { ArenaApiError } from '@/lib/arena-client';

const REDEMPTION_STATUSES = ['', 'PENDING', 'PROCESSING', 'FULFILLED', 'FAILED', 'ADMIN_REVERSED'] as const;
const STATUS_VARIANT: Record<string, 'blue' | 'mint' | 'amber' | 'slate' | 'recommended'> = {
  PENDING: 'amber',
  PROCESSING: 'blue',
  FULFILLED: 'mint',
  FAILED: 'amber',
  ADMIN_REVERSED: 'slate',
};

function jakartaDate(value: string | Date | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

type RedemptionAction = { kind: 'fulfill' | 'reverse'; row: AdminRedemption };

function RedemptionsQueue() {
  const [status, setStatus] = useState<(typeof REDEMPTION_STATUSES)[number]>('PENDING');
  const loader = useCallback(() => listAdminRedemptionsClient({ status: status || undefined, limit: 50 }), [status]);
  const redemptions = useAdminResource(loader);

  const [action, setAction] = useState<RedemptionAction | null>(null);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pushVoucher = async (row: AdminRedemption) => {
    setPushing(row.id);
    setNotice(null);
    try {
      const delivery = await pushAdminVoucher(row.id);
      setNotice(
        delivery.status === 'DELIVERED'
          ? `Voucher ${delivery.code} diterima website utama dan klaim ditandai selesai.`
          : delivery.status === 'MANUAL_REQUIRED'
            ? `Belum terkirim — ${delivery.reason} Serahkan manual lewat "Tandai selesai".`
            : delivery.status === 'ALREADY_SETTLED'
              ? 'Klaim ini sudah tidak terbuka.'
              : 'Reward ini bukan voucher.',
      );
      await redemptions.refresh();
    } catch (err) {
      setNotice(err instanceof ArenaApiError ? err.message : 'Push voucher gagal.');
    } finally {
      setPushing(null);
    }
  };

  const retryVoid = async (row: AdminRedemption) => {
    setPushing(row.id);
    setNotice(null);
    try {
      const result = await retryAdminVoucherVoid(row.id);
      setNotice(result.voided
        ? `Voucher ${result.code} berhasil dibatalkan di website utama.`
        : `Pembatalan voucher belum berhasil${result.error ? ` (${result.error})` : ''}. Coba lagi setelah koneksi diperiksa.`);
      await redemptions.refresh();
    } catch (err) {
      setNotice(err instanceof ArenaApiError ? err.message : 'Pembatalan ulang voucher gagal.');
    } finally {
      setPushing(null);
    }
  };

  const open = (a: RedemptionAction) => {
    setAction(a);
    setValue('');
    setError(null);
  };

  const submit = async () => {
    if (!action) return;
    if (!value.trim()) {
      setError(action.kind === 'fulfill' ? 'Catatan penyerahan wajib diisi.' : 'Alasan wajib diisi.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (action.kind === 'fulfill') await fulfillAdminRedemption({ redemptionId: action.row.id, reference: value });
      else await reverseAdminRedemption({ redemptionId: action.row.id, reason: value });
      setAction(null);
      await redemptions.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Aksi gagal.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PanelHeading className="mb-0">Antrean Klaim</PanelHeading>
        <select
          aria-label="Filter status klaim"
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof REDEMPTION_STATUSES)[number])}
          className="h-9 rounded-md border border-sk-border bg-white px-3 text-sm"
        >
          {REDEMPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'Semua status'}
            </option>
          ))}
        </select>
      </div>

      {redemptions.error && <p className="mb-4 text-sm text-sk-error">{redemptions.error.message}</p>}
      {notice && <p role="status" className="mb-4 text-sm text-sk-navy">{notice}</p>}

      <div className="space-y-3">
        {redemptions.data?.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-sk-border pb-3 last:border-0 last:pb-0">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sk-navy">{row.name ?? row.subject}</span>
                <Badge variant={STATUS_VARIANT[row.status] ?? 'slate'}>{row.status}</Badge>
              </div>
              <div className="mt-1 text-sm text-sk-body">
                {row.reward} · {row.pointsSpent} poin · {jakartaDate(row.redeemedAt)}
              </div>
              {row.reference && <div className="mt-1 whitespace-pre-line break-words text-xs text-sk-muted">Catatan ke peserta: {row.reference}</div>}
              {row.voucher && (row.status === 'PENDING' || row.status === 'PROCESSING') && (
                <div className="mt-1 text-xs text-sk-muted">
                  Voucher <span className="font-mono">{row.voucher.code}</span>
                  {row.voucher.deferral
                    ? <> · <span className="text-sk-error">perlu penyerahan manual</span> ({jakartaDate(row.voucher.deferral.deferredAt)}): {row.voucher.deferral.reason ?? 'push ditunda'}</>
                    : ' · belum ada catatan push'}
                </div>
              )}
              {row.status === 'ADMIN_REVERSED' && row.voucher?.revocation && !row.voucher.revocation.voided && (
                <Button size="sm" variant="ghost" loading={pushing === row.id} disabled={pushing !== null} onClick={() => void retryVoid(row)}>
                  Coba Batalkan Ulang Kode
                </Button>
              )}
              {row.voucher?.revocation && (
                <div className="mt-1 text-xs text-sk-muted">
                  Voucher <span className="font-mono">{row.voucher.code}</span>
                  {row.voucher.revocation.voided
                    ? ' · kode sudah ditarik dari website utama'
                    : <> · <span className="text-sk-error">kode mungkin masih aktif di website utama — perlu rekonsiliasi manual</span> ({jakartaDate(row.voucher.revocation.at)}){row.voucher.revocation.error ? `: ${row.voucher.revocation.error}` : ''}</>}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {row.voucher && (row.status === 'PENDING' || row.status === 'PROCESSING') && (
                <Button size="sm" variant="ghost" loading={pushing === row.id} disabled={pushing !== null} onClick={() => void pushVoucher(row)}>
                  Kirim ulang voucher
                </Button>
              )}
              {(row.status === 'PENDING' || row.status === 'PROCESSING') && (
                <Button size="sm" onClick={() => open({ kind: 'fulfill', row })}>
                  Tandai selesai
                </Button>
              )}
              {row.status !== 'ADMIN_REVERSED' && (
                <Button size="sm" variant="ghost" onClick={() => open({ kind: 'reverse', row })}>
                  Batalkan
                </Button>
              )}
            </div>
          </div>
        ))}
        {redemptions.data?.length === 0 && !redemptions.loading && (
          <p className="py-6 text-center text-sm text-sk-muted">Tidak ada klaim dengan status ini.</p>
        )}
      </div>

      <Modal open={action !== null} onClose={() => setAction(null)} labelledBy="redemption-action-title">
        <div className="p-7">
          <h3 id="redemption-action-title" className="mb-2 text-lg font-bold text-sk-navy">
            {action?.kind === 'fulfill' ? 'Tandai klaim ini selesai' : 'Batalkan klaim ini'}
          </h3>
          <p className="mb-4 text-sm text-sk-muted">
            {action?.kind === 'fulfill'
              ? 'Isi setelah reward diserahkan manual. Teks ini tampil ke peserta di profilnya: tulis nomor referensi transfer, kode voucher, link akses, atau instruksi pengambilan — jangan catatan internal. Tidak ada uang yang dikirim otomatis oleh sistem ini.'
              : action?.row.status === 'FULFILLED'
                ? 'Klaim ini sudah lunas — membatalkannya mengembalikan poin tapi TIDAK menarik kembali dana yang sudah dikirim.'
                : 'Poin peserta akan dikembalikan dan stok (jika ada) dilepas.'}
          </p>
          {action?.kind === 'fulfill' ? (
            <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Catatan penyerahan untuk peserta" rows={3} maxLength={1000} className="mb-4" />
          ) : (
            <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Alasan pembatalan" rows={3} className="mb-4" />
          )}
          {error && <p className="mb-4 text-sm text-sk-error">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setAction(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant={action?.kind === 'reverse' ? 'destructive' : 'primary'} onClick={submit} loading={pending}>
              Konfirmasi
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

type CatalogAction = { rewardId: string; title: string; isActive: boolean };
type QuantityAction = { periodId: string; current: number; rewardTitle: string };

function InventoryPanel() {
  // Stable loader: useAdminResource refetches whenever the loader's identity
  // changes, so an inline arrow re-requested the inventory on every render — an
  // endless request loop for as long as the page stayed open.
  const inventory = useAdminResource(useCallback(() => getAdminInventory(), []));
  const [catalogAction, setCatalogAction] = useState<CatalogAction | null>(null);
  const [quantityAction, setQuantityAction] = useState<QuantityAction | null>(null);
  const [reason, setReason] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCatalog = async () => {
    if (!catalogAction || !reason.trim()) {
      setError('Alasan wajib diisi.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await setAdminRewardActive({ rewardId: catalogAction.rewardId, isActive: !catalogAction.isActive, reason });
      setCatalogAction(null);
      setReason('');
      await inventory.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Aksi gagal.');
    } finally {
      setPending(false);
    }
  };

  const submitQuantity = async () => {
    if (!quantityAction || !reason.trim()) {
      setError('Alasan wajib diisi.');
      return;
    }
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Kuota harus bilangan bulat ≥ 0.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await setAdminInventoryQuantity({ periodId: quantityAction.periodId, quantityTotal: parsed, reason });
      setQuantityAction(null);
      setReason('');
      await inventory.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Aksi gagal.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="p-6">
      <PanelHeading>Katalog Reward</PanelHeading>
      {inventory.error && <p className="mb-4 text-sm text-sk-error">{inventory.error.message}</p>}
      <div className="space-y-3">
        {inventory.data?.rewards.map((reward) => {
          const periods = inventory.data?.periods.filter((p) => p.rewardId === reward.id) ?? [];
          return (
            <div key={reward.id} className="border-b border-sk-border pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sk-navy">{reward.title}</span>
                    <Badge variant={reward.isActive ? 'mint' : 'slate'}>{reward.isActive ? 'AKTIF' : 'NONAKTIF'}</Badge>
                    <Badge variant="slate">{reward.pointsCost} poin</Badge>
                  </div>
                  {reward.description && <p className="mt-1 text-sm text-sk-muted">{reward.description}</p>}
                </div>
                <Button
                  size="sm"
                  variant={reward.isActive ? 'destructive' : 'ghost'}
                  onClick={() => {
                    setCatalogAction({ rewardId: reward.id, title: reward.title, isActive: reward.isActive });
                    setReason('');
                    setError(null);
                  }}
                >
                  {reward.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </div>
              {reward.inventoryMode === 'LIMITED' && periods.length > 0 && (
                <div className="mt-2 space-y-1.5 pl-1">
                  {periods.map((period) => (
                    <div key={period.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-sk-muted">
                      <span>
                        {jakartaDate(period.periodStart)} – {jakartaDate(period.periodEnd)}: {period.quantityReserved + period.quantityFulfilled}/
                        {period.quantityTotal} terpakai
                      </span>
                      <Button
                        size="sm"
                        variant="text"
                        onClick={() => {
                          setQuantityAction({ periodId: period.id, current: period.quantityTotal, rewardTitle: reward.title });
                          setQuantity(String(period.quantityTotal));
                          setReason('');
                          setError(null);
                        }}
                      >
                        Ubah kuota
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={catalogAction !== null} onClose={() => setCatalogAction(null)} labelledBy="catalog-action-title">
        <div className="p-7">
          <h3 id="catalog-action-title" className="mb-2 text-lg font-bold text-sk-navy">
            {catalogAction?.isActive ? `Nonaktifkan "${catalogAction.title}"?` : `Aktifkan "${catalogAction?.title}"?`}
          </h3>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" rows={3} className="mb-4 mt-3" />
          {error && <p className="mb-4 text-sm text-sk-error">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setCatalogAction(null)} disabled={pending}>
              Batal
            </Button>
            <Button onClick={submitCatalog} loading={pending}>
              Konfirmasi
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={quantityAction !== null} onClose={() => setQuantityAction(null)} labelledBy="quantity-action-title">
        <div className="p-7">
          <h3 id="quantity-action-title" className="mb-2 text-lg font-bold text-sk-navy">
            Ubah kuota — {quantityAction?.rewardTitle}
          </h3>
          <p className="mb-3 text-sm text-sk-muted">Tidak bisa lebih kecil dari yang sudah terpakai/dipesan.</p>
          <Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mb-3" />
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" rows={3} className="mb-4" />
          {error && <p className="mb-4 text-sm text-sk-error">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setQuantityAction(null)} disabled={pending}>
              Batal
            </Button>
            <Button onClick={submitQuantity} loading={pending}>
              Simpan
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

export default function AdminRewardsPage() {
  return (
    <AdminShell title="Reward">
      <div className="space-y-6">
        <RedemptionsQueue />
        <InventoryPanel />
      </div>
    </AdminShell>
  );
}
