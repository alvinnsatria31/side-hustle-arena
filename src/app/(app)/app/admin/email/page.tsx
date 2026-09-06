'use client';

import { useCallback, useState } from 'react';
import {
  cancelAdminEmailDelivery,
  getAdminEmailOutbox,
  requeueAdminEmailDelivery,
  useAdminResource,
  type AdminEmailDelivery,
  type EmailBucket,
} from '@/lib/admin-client';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { Textarea } from '@/components/primitives/Textarea';
import { ArenaApiError } from '@/lib/arena-client';

/**
 * The EMAIL outbox, from the operator's side.
 *
 * Buckets are the worker's own reasoning made visible — see
 * `server/notifications/outbox-admin.ts`. "Tertahan" is the only one that
 * needs a human: everything else either moves on its own or is already done.
 */
const BUCKETS: Array<{ id: EmailBucket; label: string; hint: string }> = [
  { id: 'held', label: 'Tertahan', hint: 'Worker menyerah — hanya bergerak kalau kamu yang menggerakkan.' },
  { id: 'due', label: 'Siap kirim', hint: 'Akan diambil pada flush berikutnya.' },
  { id: 'backingOff', label: 'Menunggu retry', hint: 'Gagal, tapi jadwal percobaan berikutnya belum tiba.' },
  { id: 'inFlight', label: 'Sedang dikirim', hint: 'Lease masih dipegang worker.' },
  { id: 'skipped', label: 'Dilewati', hint: 'Tidak pernah dikirim: tanpa email, akun nonaktif, atau dibatalkan admin.' },
  { id: 'sent', label: 'Terkirim', hint: 'Sudah punya tanda terima dari provider.' },
];

const BUCKET_VARIANT: Record<EmailBucket, 'blue' | 'mint' | 'amber' | 'slate'> = {
  held: 'amber',
  due: 'blue',
  backingOff: 'amber',
  inFlight: 'blue',
  skipped: 'slate',
  sent: 'mint',
};

function jakartaDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

type OutboxAction = { kind: 'requeue' | 'cancel'; row: AdminEmailDelivery };

export default function AdminEmailPage() {
  const [bucket, setBucket] = useState<EmailBucket>('held');
  const loader = useCallback(() => getAdminEmailOutbox({ bucket, limit: 50 }), [bucket]);
  const outbox = useAdminResource(loader);

  const [action, setAction] = useState<OutboxAction | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (next: OutboxAction) => {
    setAction(next);
    setReason('');
    setError(null);
  };

  const submit = async () => {
    if (!action) return;
    if (!reason.trim()) {
      setError('Alasan wajib diisi — tindakan ini masuk ke audit log.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const input = { deliveryId: action.row.id, reason };
      if (action.kind === 'requeue') await requeueAdminEmailDelivery(input);
      else await cancelAdminEmailDelivery(input);
      setAction(null);
      await outbox.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Aksi gagal.');
    } finally {
      setPending(false);
    }
  };

  const summary = outbox.data?.summary;
  const rows = outbox.data?.rows ?? [];
  const active = BUCKETS.find((b) => b.id === bucket);
  const anomalies = summary ? summary.anomalies.sentWithoutReceipt + summary.anomalies.exhaustedNotFailed : 0;

  return (
    <AdminShell title="Antrean Email" action={<AdminRefreshButton refresh={outbox.refresh} loading={outbox.loading} />}>
      {summary && !summary.senderConfigured && (
        <Card className="mb-6 border-sk-warning/40 bg-sk-warning-tint p-5">
          <p className="text-sm text-sk-body">
            <b className="text-sk-navy">Pengirim belum dikonfigurasi.</b> Tanpa <code>RESEND_API_KEY</code>, flush berhenti sebelum
            mengambil apa pun — antrean menumpuk tapi tidak ada percobaan yang terpakai. Angka di bawah tetap nyata.
          </p>
        </Card>
      )}

      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBucket(b.id)}
            aria-pressed={bucket === b.id}
            title={b.hint}
            className={`rounded-xl border p-4 text-left transition-colors ${
              bucket === b.id ? 'border-sk-blue bg-sk-blue-tint' : 'border-sk-border bg-white hover:border-sk-blue/40'
            }`}
          >
            <div className="text-xs text-sk-muted">{b.label}</div>
            <div className={`mt-1.5 text-2xl font-extrabold tabular-nums ${b.id === 'held' && (summary?.counts.held ?? 0) > 0 ? 'text-sk-warning' : 'text-sk-navy'}`}>
              {summary ? summary.counts[b.id] : '—'}
            </div>
          </button>
        ))}
      </div>

      {summary && (summary.staleLeases > 0 || anomalies > 0) && (
        <Card className="mb-6 p-5">
          <PanelHeading>Rekonsiliasi</PanelHeading>
          <ul className="space-y-2 text-sm text-sk-body">
            {summary.staleLeases > 0 && (
              <li>
                <b className="text-sk-navy">{summary.staleLeases}</b> lease kedaluwarsa — worker mati di tengah kirim. Claim
                berikutnya mengambilnya kembali secara otomatis; angka yang terus naik berarti worker-nya crash berulang.
              </li>
            )}
            {summary.anomalies.sentWithoutReceipt > 0 && (
              <li>
                <b className="text-sk-warning">{summary.anomalies.sentWithoutReceipt}</b> baris berstatus SENT tanpa tanda terima
                provider. Ini melanggar invarian penulis outbox — periksa manual, jangan di-requeue.
              </li>
            )}
            {summary.anomalies.exhaustedNotFailed > 0 && (
              <li>
                <b className="text-sk-warning">{summary.anomalies.exhaustedNotFailed}</b> baris kehabisan percobaan tapi belum
                ditandai FAILED.
              </li>
            )}
          </ul>
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <PanelHeading className="mb-0">{active?.label}</PanelHeading>
          <span className="text-xs text-sk-muted">{rows.length} baris</span>
        </div>
        <p className="mb-4 text-sm text-sk-muted">{active?.hint}</p>

        {outbox.error && <p className="mb-4 text-sm text-sk-error">{outbox.error.message}</p>}

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-sk-border pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sk-navy">{row.subject}</span>
                  <Badge variant={BUCKET_VARIANT[row.bucket]}>{row.status}</Badge>
                  {row.errorCode && <Badge variant="slate">{row.errorCode}</Badge>}
                </div>
                <div className="mt-1 text-sm text-sk-body">
                  {row.recipient ?? 'tanpa email'} · percobaan {row.attemptCount}
                </div>
                <div className="mt-1 font-mono text-xs text-sk-muted">
                  dibuat {jakartaDate(row.createdAt)} · berikutnya {jakartaDate(row.availableAt)}
                  {row.sentAt && ` · terkirim ${jakartaDate(row.sentAt)}`}
                </div>
              </div>
              {row.bucket !== 'sent' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => open({ kind: 'requeue', row })} disabled={row.bucket === 'inFlight'}>
                    Kirim ulang
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => open({ kind: 'cancel', row })} disabled={row.bucket === 'inFlight'}>
                    Hentikan
                  </Button>
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && !outbox.loading && (
            <p className="py-6 text-center text-sm text-sk-muted">Tidak ada email di kategori ini.</p>
          )}
        </div>
      </Card>

      <Modal open={action !== null} onClose={() => setAction(null)} labelledBy="email-action-title">
        <div className="p-7">
          <h3 id="email-action-title" className="mb-2 text-lg font-bold text-sk-navy">
            {action?.kind === 'requeue' ? 'Kirim ulang email ini' : 'Hentikan pengiriman email ini'}
          </h3>
          <p className="mb-4 text-sm text-sk-muted">
            {action?.kind === 'requeue'
              ? 'Hitungan percobaan direset dan baris kembali ke antrean. Isi pesannya tidak dirender ulang — teks yang dibekukan saat percobaan pertama tetap dipakai, supaya satu idempotency key tidak mewakili dua isi berbeda.'
              : 'Baris ditandai SKIPPED dan worker berhenti mencobanya. Tidak bisa dikembalikan kecuali kamu kirim ulang secara manual.'}
          </p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan (masuk audit log)" rows={3} className="mb-4" />
          {error && <p className="mb-4 text-sm text-sk-error">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setAction(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant={action?.kind === 'cancel' ? 'destructive' : 'primary'} onClick={submit} loading={pending}>
              Konfirmasi
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
