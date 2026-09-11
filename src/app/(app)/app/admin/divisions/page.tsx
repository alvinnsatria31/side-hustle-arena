'use client';

import { useCallback, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  type AdminBaseCriterion,
  type AdminDivision,
} from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';

type RubricRow = { name: string; weight: string; maxScore: string };
type Draft = { slug: string; name: string; description: string; isActive: boolean; sortOrder: string; rubric: RubricRow[] };

const EMPTY_ROW: RubricRow = { name: '', weight: '1', maxScore: '100' };
const EMPTY: Draft = { slug: '', name: '', description: '', isActive: true, sortOrder: '0', rubric: [EMPTY_ROW] };
const RUBRIC_GRID = 'grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_2.5rem] items-center gap-2';

const toRows = (rubric: AdminBaseCriterion[] | null | undefined): RubricRow[] =>
  rubric?.length ? rubric.map((c) => ({ name: c.name, weight: String(c.weight), maxScore: String(c.maxScore) })) : [EMPTY_ROW];

// Mirrors baseRubricSchema so the operator is told which row is wrong, not that the rubric failed somewhere.
function parseRubric(rows: RubricRow[]): AdminBaseCriterion[] | string {
  if (rows.length === 0 || rows.length > 20) return 'Base rubric butuh 1–20 kriteria.';
  const seen = new Set<string>();
  const parsed: AdminBaseCriterion[] = [];
  for (const [index, row] of rows.entries()) {
    const label = `Kriteria ${index + 1}`;
    const name = row.name.trim();
    const weight = Number(row.weight);
    const maxScore = Number(row.maxScore);
    if (name.length < 2 || name.length > 200) return `${label}: nama harus 2–200 karakter.`;
    // The server's duplicate rule: case, punctuation and spacing do not make two criteria different.
    const key = name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (seen.has(key)) return `${label}: nama "${name}" sama dengan kriteria lain.`;
    seen.add(key);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) return `${label}: bobot harus di atas 0 dan maksimal 100.`;
    if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 100) return `${label}: skor maksimum harus di atas 0 dan maksimal 100.`;
    parsed.push({ name, weight, maxScore });
  }
  return parsed;
}

export default function AdminDivisionsPage() {
  const divisions = useAdminResource(useCallback(() => listAdminDivisionsClient(), []));
  const [editing, setEditing] = useState<AdminDivision | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = divisions.data?.filter((division) => division.baseRubric?.length) ?? [];
  const needsRubric = creating || (editing !== null && !editing.hasBaseRubric);

  const openCreate = () => {
    setDraft({ ...EMPTY, rubric: toRows(templates[0]?.baseRubric) });
    setEditing(null);
    setCreating(true);
    setError(null);
  };

  const openEdit = (division: AdminDivision) => {
    setDraft({
      slug: division.slug, name: division.name, description: division.description ?? '',
      isActive: division.isActive, sortOrder: String(division.sortOrder),
      rubric: toRows(division.baseRubric ?? templates[0]?.baseRubric),
    });
    setEditing(division);
    setCreating(false);
    setError(null);
  };

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const setRow = (index: number, patch: Partial<RubricRow>) =>
    setDraft((current) => ({ ...current, rubric: current.rubric.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const sortOrder = Number(draft.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError('Urutan harus bilangan bulat non-negatif.');
      setBusy(false);
      return;
    }
    const rubric = needsRubric ? parseRubric(draft.rubric) : undefined;
    if (typeof rubric === 'string') {
      setError(rubric);
      setBusy(false);
      return;
    }
    try {
      if (editing) {
        await updateAdminDivisionClient({
          divisionId: editing.id, name: draft.name,
          description: draft.description.trim() || null, isActive: draft.isActive, sortOrder,
          ...(rubric ? { baseRubric: rubric } : {}),
        });
      } else {
        await createAdminDivisionClient({
          slug: draft.slug, name: draft.name,
          description: draft.description.trim() || null, isActive: draft.isActive, sortOrder,
          baseRubric: rubric,
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
        dilewati minggu berikutnya, tanpa menyentuh project yang sudah terbit. Divisi baru langsung
        dibekukan base rubric-nya saat dibuat, jadi generator bisa memprosesnya di rilis berikutnya.
      </p>

      {divisions.data?.some((division) => division.isActive && !division.hasBaseRubric) && (
        <div className="mb-5 border-l-2 border-sk-warning bg-sk-warning-tint p-4 text-sm leading-relaxed text-sk-body">
          <p className="font-bold text-sk-navy">Sebagian divisi aktif belum punya base rubric.</p>
          <p className="mt-1">
            Generator menolak jalan untuk divisi tanpa base rubric, jadi rilis akan gagal di langkah
            generate. Buka <strong>Ubah</strong> pada divisi itu lalu simpan base rubric-nya (bisa disalin
            dari divisi lain). Divisi yang sudah punya project terbit juga bisa memakai{' '}
            <code className="font-mono text-xs">node scripts/bootstrap-generation-library.mjs</code>.
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
        <div className="max-h-[85vh] overflow-y-auto p-7">
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

          <div className="mb-4 border-t border-sk-border pt-4">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-sk-navy">Base rubric</span>
              {needsRubric && templates.length > 0 && (
                <select
                  aria-label="Salin base rubric dari divisi lain"
                  value=""
                  onChange={(e) => {
                    const source = templates.find((division) => division.id === e.target.value);
                    if (source) setDraft((current) => ({ ...current, rubric: toRows(source.baseRubric) }));
                  }}
                  className="h-9 max-w-full rounded-md border border-sk-border bg-white px-2 text-xs"
                >
                  <option value="" disabled>Salin dari divisi…</option>
                  {templates.map((division) => (
                    <option key={division.id} value={division.id}>{division.name}</option>
                  ))}
                </select>
              )}
            </div>

            {needsRubric ? (
              <>
                <p className="mb-3 text-[11.5px] leading-relaxed text-sk-muted">
                  Nama, bobot, dan skor maksimum tiap kriteria <strong>dibekukan permanen</strong> saat disimpan: setiap
                  project divisi ini wajib memakai rubric yang persis sama. Penjelasan dan instruksi penilaian tetap
                  ditulis per project di editor project.
                </p>
                <div className={`${RUBRIC_GRID} mb-1 text-[11px] text-sk-muted`}>
                  <span>Kriteria</span><span>Bobot</span><span>Skor maks</span><span />
                </div>
                <div className="space-y-2">
                  {draft.rubric.map((row, index) => (
                    <div key={index} className={RUBRIC_GRID}>
                      <Input aria-label={`Nama kriteria ${index + 1}`} value={row.name} onChange={(e) => setRow(index, { name: e.target.value })} />
                      <Input aria-label={`Bobot kriteria ${index + 1}`} type="number" min={0} max={100} step="any" value={row.weight}
                        onChange={(e) => setRow(index, { weight: e.target.value })} />
                      <Input aria-label={`Skor maksimum kriteria ${index + 1}`} type="number" min={0} max={100} step="any" value={row.maxScore}
                        onChange={(e) => setRow(index, { maxScore: e.target.value })} />
                      <button
                        type="button"
                        aria-label={`Hapus kriteria ${index + 1}`}
                        disabled={draft.rubric.length === 1}
                        onClick={() => setDraft((current) => ({ ...current, rubric: current.rubric.filter((_, i) => i !== index) }))}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-sk-muted hover:bg-sk-bg hover:text-sk-error disabled:opacity-40"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <Button size="sm" variant="ghost" disabled={draft.rubric.length >= 20}
                    onClick={() => setDraft((current) => ({ ...current, rubric: [...current.rubric, EMPTY_ROW] }))}
                    iconLeft={<Plus size={14} aria-hidden />}>
                    Tambah kriteria
                  </Button>
                </div>
              </>
            ) : (
              <ul className="space-y-1 text-[13px] text-sk-body">
                {editing?.baseRubric?.map((criterion, index) => (
                  <li key={`${criterion.name}-${index}`}>
                    {criterion.name} <span className="text-xs text-sk-muted">· bobot {criterion.weight} · maks {criterion.maxScore}</span>
                  </li>
                ))}
                <li className="pt-1 text-[11.5px] text-sk-muted">Sudah dibekukan dan tidak bisa diubah.</li>
              </ul>
            )}
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
