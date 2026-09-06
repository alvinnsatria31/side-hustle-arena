'use client';

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import {
  createAdminDivisionClient,
  listAdminDivisionsClient,
  updateAdminDivisionClient,
  useAdminResource,
  type AdminDivision,
} from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';

type Draft = { slug: string; name: string; description: string; isActive: boolean; sortOrder: string };

const EMPTY: Draft = { slug: '', name: '', description: '', isActive: true, sortOrder: '0' };

export default function AdminDivisionsPage() {
  const divisions = useAdminResource(useCallback(() => listAdminDivisionsClient(), []));
  const [editing, setEditing] = useState<AdminDivision | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setDraft(EMPTY);
    setEditing(null);
    setCreating(true);
    setError(null);
  };

  const openEdit = (division: AdminDivision) => {
    setDraft({
      slug: division.slug, name: division.name, description: division.description ?? '',
      isActive: division.isActive, sortOrder: String(division.sortOrder),
    });
    setEditing(division);
    setCreating(false);
    setError(null);
  };

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const sortOrder = Number(draft.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError('Urutan harus bilangan bulat non-negatif.');
      setBusy(false);
      return;
    }
    try {
      if (editing) {
        await updateAdminDivisionClient({
          divisionId: editing.id, name: draft.name,
          description: draft.description.trim() || null, isActive: draft.isActive, sortOrder,
        });
      } else {
        await createAdminDivisionClient({
          slug: draft.slug, name: draft.name,
          description: draft.description.trim() || null, isActive: draft.isActive, sortOrder,
        });
      }
      close();
      await divisions.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Perubahan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell
      title="Divisi"
      action={
        <div className="flex gap-2">
          <Button size="sm" onClick={openCreate} iconLeft={<Plus size={15} aria-hidden />}>Divisi baru</Button>
          <AdminRefreshButton refresh={divisions.refresh} loading={divisions.loading} />
        </div>
      }
    >
      {divisions.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {divisions.error.message}
        </div>
      )}

      <p className="mb-5 text-sm text-sk-muted">
        Generator project membuat satu project per divisi aktif. Menonaktifkan divisi berarti divisi itu
        dilewati minggu berikutnya, tanpa menyentuh project yang sudah terbit.
      </p>

      {divisions.data?.some((division) => division.isActive && !division.hasBaseRubric) && (
        <div className="mb-5 border-l-2 border-sk-warning bg-sk-warning-tint p-4 text-sm leading-relaxed text-sk-body">
          <p className="font-bold text-sk-navy">Sebagian divisi belum punya base rubric.</p>
          <p className="mt-1">
            Generator menolak jalan untuk divisi tanpa base rubric, jadi rilis akan gagal di langkah
            generate. Base rubric terbentuk saat satu project yang sudah terbit didaftarkan sebagai
            library template. Jalankan{' '}
            <code className="font-mono text-xs">node scripts/bootstrap-generation-library.mjs</code>{' '}
            sekali terhadap database ini untuk mendaftarkannya.
          </p>
        </div>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-sk-bg text-xs text-sk-muted">
            <tr>
              <th className="p-4">Nama</th>
              <th className="p-4">Slug</th>
              <th className="p-4">Deskripsi</th>
              <th className="p-4">Status</th>
              <th className="p-4">Base rubric</th>
              <th className="p-4 text-right">Urutan</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sk-border">
            {divisions.data?.map((division) => (
              <tr key={division.id}>
                <td className="p-4 font-semibold text-sk-navy">{division.name}</td>
                <td className="p-4 font-mono text-[11px] text-sk-muted">{division.slug}</td>
                <td className="max-w-md p-4 text-xs text-sk-body">{division.description ?? '—'}</td>
                <td className="p-4"><Badge variant={division.isActive ? 'mint' : 'slate'}>{division.isActive ? 'AKTIF' : 'NONAKTIF'}</Badge></td>
                <td className="p-4">
                  <Badge variant={division.hasBaseRubric ? 'mint' : 'amber'}>{division.hasBaseRubric ? 'SIAP' : 'BELUM'}</Badge>
                </td>
                <td className="p-4 text-right text-xs tabular-nums text-sk-muted">{division.sortOrder}</td>
                <td className="p-4 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(division)}>Ubah</Button>
                </td>
              </tr>
            ))}
            {divisions.data?.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-sk-muted">Belum ada divisi.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={creating || editing !== null} onClose={close} labelledBy="division-form-title">
        <div className="p-7">
          <h3 id="division-form-title" className="mb-4 text-lg font-bold text-sk-navy">
            {editing ? `Ubah ${editing.name}` : 'Divisi baru'}
          </h3>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Slug</span>
            <Input value={draft.slug} disabled={editing !== null}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="data-analyst" />
            <span className="mt-1.5 block text-[11.5px] text-sk-muted">
              {editing ? 'Slug tidak bisa diubah — sudah dipakai sebagai identitas publik.' : 'Huruf kecil, dipisah tanda hubung.'}
            </span>
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Nama</span>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Deskripsi</span>
            <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>

          <div className="mb-4 flex items-end gap-4">
            <label className="block w-32">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Urutan</span>
              <Input type="number" min={0} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />
            </label>
            <label className="flex h-11 items-center gap-2 text-[13px] font-medium text-sk-body">
              <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              Aktif
            </label>
          </div>

          {error && <p role="alert" className="mb-4 text-sm text-sk-error">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>Batal</Button>
            <Button loading={busy} disabled={!draft.name.trim() || (!editing && !draft.slug.trim())} onClick={submit}>
              Simpan
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
