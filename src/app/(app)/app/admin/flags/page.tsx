'use client';

import { useState } from 'react';
import { getAdminOverview, setAdminFlag, useAdminResource } from '@/lib/admin-client';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { Textarea } from '@/components/primitives/Textarea';
import { ArenaApiError } from '@/lib/arena-client';

export default function AdminFlagsPage() {
  const overview = useAdminResource(getAdminOverview);
  const [target, setTarget] = useState<{ key: string; label: string; closing: boolean } | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!target) return;
    setPending(true);
    setError(null);
    try {
      await setAdminFlag(target.key, target.closing, target.closing ? message.trim() || null : null);
      setTarget(null);
      setMessage('');
      await overview.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Gagal mengubah saklar.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AdminShell title="Saklar Darurat" action={<AdminRefreshButton refresh={overview.refresh} loading={overview.loading} />}>
      <p className="mb-6 max-w-2xl text-sm text-sk-muted">
        Menutup sebuah saklar berlaku langsung tanpa deploy ulang, dan hanya memblokir aksi peserta baru — pekerjaan yang
        sudah berjalan (review di antrean, draft tersimpan) tidak terganggu.
      </p>

      {overview.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {overview.error.message}
        </div>
      )}

      <div className="space-y-3">
        {overview.data?.flags.map((flag) => (
          <Card key={flag.key} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sk-navy">{flag.label}</span>
                <Badge variant={flag.state.closed ? 'amber' : 'mint'}>{flag.state.closed ? 'DITUTUP' : 'TERBUKA'}</Badge>
              </div>
              <p className="mt-1 max-w-xl text-sm text-sk-muted">{flag.blurb}</p>
              {flag.state.closed && flag.state.message && (
                <p className="mt-1.5 text-xs italic text-sk-warning-ink">&ldquo;{flag.state.message}&rdquo;</p>
              )}
            </div>
            <Button
              variant={flag.state.closed ? 'primary' : 'destructive'}
              size="sm"
              onClick={() => setTarget({ key: flag.key, label: flag.label, closing: !flag.state.closed })}
            >
              {flag.state.closed ? 'Buka kembali' : 'Tutup sekarang'}
            </Button>
          </Card>
        ))}
      </div>

      <Modal open={target !== null} onClose={() => setTarget(null)} labelledBy="flag-modal-title">
        <div className="p-7">
          <h3 id="flag-modal-title" className="mb-2 text-lg font-bold text-sk-navy">
            {target?.closing ? `Tutup "${target.label}"?` : `Buka kembali "${target?.label}"?`}
          </h3>
          <p className="mb-4 text-sm text-sk-muted">
            {target?.closing
              ? 'Peserta akan melihat pesan penutupan di bawah ini sampai kamu membuka kembali saklar ini.'
              : 'Peserta bisa langsung memakai fitur ini lagi.'}
          </p>
          {target?.closing && (
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Pesan untuk peserta (opsional), mis. Sedang maintenance, coba lagi 30 menit."
              rows={3}
              className="mb-4"
            />
          )}
          {error && <p className="mb-4 text-sm text-sk-error">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant={target?.closing ? 'destructive' : 'primary'} onClick={submit} loading={pending}>
              {target?.closing ? 'Tutup' : 'Buka'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
