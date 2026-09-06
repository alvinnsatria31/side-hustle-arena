'use client';

import { useCallback, useState } from 'react';
import { listAdminUsersClient, setAdminUserStatusClient, useAdminResource, type AdminUser } from '@/lib/admin-client';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { ArenaApiError } from '@/lib/arena-client';

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const loader = useCallback(() => listAdminUsersClient({ q: q || undefined, limit: 50 }), [q]);
  const users = useAdminResource(loader);

  const [target, setTarget] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = target?.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

  const submit = async () => {
    if (!target) return;
    if (!reason.trim()) {
      setError('Alasan wajib diisi untuk jejak audit.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await setAdminUserStatusClient({ userId: target.id, status: nextStatus, reason });
      setTarget(null);
      setReason('');
      await users.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Aksi gagal.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AdminShell title="Peserta" action={<AdminRefreshButton refresh={users.refresh} loading={users.loading} />}>
      <div className="mb-5 max-w-sm">
        <Input placeholder="Cari nama, email, atau subject..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {users.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {users.error.message}
        </div>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-sk-bg text-xs text-sk-muted">
            <tr>
              <th className="p-4">Nama</th>
              <th className="p-4">Email</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sk-border">
            {users.data?.map((user) => (
              <tr key={user.id}>
                <td className="p-4 font-semibold text-sk-navy">{user.name ?? '—'}</td>
                <td className="p-4 text-sk-body">{user.email ?? '—'}</td>
                <td className="p-4">
                  <Badge variant={user.status === 'ACTIVE' ? 'mint' : 'amber'}>{user.status}</Badge>
                </td>
                <td className="p-4 text-right">
                  <Button
                    size="sm"
                    variant={user.status === 'ACTIVE' ? 'destructive' : 'ghost'}
                    onClick={() => {
                      setTarget(user);
                      setReason('');
                      setError(null);
                    }}
                  >
                    {user.status === 'ACTIVE' ? 'Suspend' : 'Aktifkan'}
                  </Button>
                </td>
              </tr>
            ))}
            {users.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-sk-muted">
                  Tidak ada peserta yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={target !== null} onClose={() => setTarget(null)} labelledBy="user-action-title">
        <div className="p-7">
          <h3 id="user-action-title" className="mb-2 text-lg font-bold text-sk-navy">
            {nextStatus === 'SUSPENDED' ? `Suspend ${target?.name ?? 'peserta ini'}?` : `Aktifkan kembali ${target?.name ?? 'peserta ini'}?`}
          </h3>
          <p className="mb-4 text-sm text-sk-muted">
            {nextStatus === 'SUSPENDED'
              ? 'Peserta tidak bisa login atau mengakses Arena sampai diaktifkan kembali.'
              : 'Peserta bisa login dan mengakses Arena lagi.'}
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Alasan (wajib, tersimpan di audit log)"
            rows={3}
            className="mb-4"
          />
          {error && <p className="mb-4 text-sm text-sk-error">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant={nextStatus === 'SUSPENDED' ? 'destructive' : 'primary'} onClick={submit} loading={pending}>
              Konfirmasi
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
