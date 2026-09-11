'use client';

import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/primitives/Modal';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { createAdminJobSourceClient, type AdminJobSourceCreated } from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';

const CATEGORIES = ['Umum', 'Teknologi', 'Data & Analitik', 'Bisnis & Marketing', 'Kreatif & Desain', 'Magang', 'Remote'];

type Form = {
  name: string;
  siteUrl: string;
  feedUrl: string;
  category: string;
  itemsPath: string;
  externalId: string;
  title: string;
  company: string;
  applicationUrl: string;
  location: string;
  employmentType: string;
  workMode: string;
  requiredSkills: string;
  postedAt: string;
  credentialEnvVar: string;
  authHeader: string;
  authScheme: string;
  syncIntervalMinutes: string;
  activate: boolean;
  syncNow: boolean;
  reason: string;
};

/** Defaults match the most common JSON job-feed shape; every path is editable. */
const EMPTY: Form = {
  name: '', siteUrl: '', feedUrl: '', category: 'Umum', itemsPath: 'items',
  externalId: 'id', title: 'title', company: 'company', applicationUrl: 'url',
  location: 'location', employmentType: '', workMode: '', requiredSkills: '', postedAt: '',
  credentialEnvVar: '', authHeader: 'Authorization', authScheme: 'Bearer ',
  syncIntervalMinutes: '360', activate: true, syncNow: true, reason: '',
};

function urlProblem(value: string, label: string, required: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? `${label} wajib diisi.` : null;
  try {
    const url = new URL(trimmed);
    if (url.username || url.password) return `${label} tidak boleh memuat nama pengguna atau kata sandi.`;
    // Plain HTTP is decided by the server: it is allowed in the local sandbox only.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return `${label} harus alamat http(s).`;
  } catch {
    return `${label} bukan URL yang valid.`;
  }
  return null;
}

function formProblem(form: Form): string | null {
  if (form.name.trim().length < 2) return 'Nama sumber minimal 2 karakter.';
  const feed = urlProblem(form.feedUrl, 'URL feed', true);
  if (feed) return feed;
  const site = urlProblem(form.siteUrl, 'Base URL situs', false);
  if (site) return site;
  if (form.siteUrl.trim() && !form.siteUrl.trim().startsWith('https://')) return 'Base URL situs harus https://.';
  for (const [key, label] of [['externalId', 'ID lowongan'], ['title', 'judul'], ['company', 'perusahaan'], ['applicationUrl', 'URL lamaran']] as const) {
    if (!form[key].trim()) return `Path field ${label} wajib diisi.`;
  }
  if (form.credentialEnvVar.trim() && !/^[A-Z][A-Z0-9_]{1,63}$/.test(form.credentialEnvVar.trim())) {
    return 'Nama variabel environment hanya huruf besar, angka dan garis bawah — contoh GLINTS_API_TOKEN.';
  }
  const interval = Number(form.syncIntervalMinutes);
  if (!Number.isInteger(interval) || interval < 15 || interval > 10_080) return 'Interval sync 15–10.080 menit.';
  if (!form.reason.trim()) return 'Alasan wajib diisi (tercatat di audit log).';
  return null;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[12px] font-semibold text-sk-navy">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] leading-relaxed text-sk-muted">{hint}</span>}
    </label>
  );
}

const selectClass = 'h-10 w-full rounded-md border border-sk-border bg-white px-3 text-sm text-sk-navy disabled:bg-sk-bg';

/**
 * "+ Tambah Sumber Lowongan": register a JSON jobs feed without touching the
 * database. The server validates the same contract the sync adapter reads, so
 * what saves here is what the sync can run; this form only catches the obvious
 * mistakes early and names the field.
 */
export function AddJobSourceDialog({ onCreated, variant = 'primary' }: {
  onCreated?: (result: AdminJobSourceCreated) => void | Promise<void>;
  variant?: 'primary' | 'ghost';
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const close = () => { if (!busy) setOpen(false); };

  const submit = async () => {
    const problem = formProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const opt = (value: string) => value.trim() || undefined;
    const withCredential = Boolean(form.credentialEnvVar.trim());
    try {
      const result = await createAdminJobSourceClient({
        name: form.name.trim(),
        adapter: 'http-json',
        feedUrl: form.feedUrl.trim(),
        siteUrl: opt(form.siteUrl),
        category: opt(form.category),
        itemsPath: opt(form.itemsPath),
        fieldMap: {
          externalId: form.externalId.trim(),
          title: form.title.trim(),
          company: form.company.trim(),
          applicationUrl: form.applicationUrl.trim(),
          location: opt(form.location),
          employmentType: opt(form.employmentType),
          workMode: opt(form.workMode),
          requiredSkills: opt(form.requiredSkills),
          postedAt: opt(form.postedAt),
        },
        credentialEnvVar: opt(form.credentialEnvVar),
        authHeader: withCredential ? opt(form.authHeader) : undefined,
        authScheme: withCredential ? form.authScheme : undefined,
        syncIntervalMinutes: Number(form.syncIntervalMinutes),
        activate: form.activate,
        syncNow: form.activate && form.syncNow,
        reason: form.reason.trim(),
      });
      setOpen(false);
      setForm(EMPTY);
      await onCreated?.(result);
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Sumber gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant={variant} iconLeft={<Plus size={15} aria-hidden />}
        onClick={() => { setError(null); setOpen(true); }}>
        Tambah Sumber Lowongan
      </Button>
      <Modal open={open} onClose={close} labelledBy="add-job-source-title" className="max-w-2xl">
        <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-7">
          <h3 id="add-job-source-title" className="mb-1 pr-10 text-lg font-bold text-sk-navy">Tambah sumber lowongan</h3>
          <p className="mb-5 text-[12.5px] leading-relaxed text-sk-muted">
            Sumber adalah feed JSON yang dibaca adapter <code className="rounded bg-sk-blue-wash px-1">http-json</code>.
            Isi path titik untuk tiap field (mis. <code className="rounded bg-sk-blue-wash px-1">company.name</code>).
            Token tidak pernah diisi di sini — cukup nama variabel environment tempat token disimpan di server.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama sumber"><Input value={form.name} placeholder="TechInAsia / Glints" onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Kategori">
              <select className={selectClass} value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Base URL situs" hint="Halaman publik penyedia, hanya untuk ditampilkan. Opsional.">
              <Input type="url" inputMode="url" value={form.siteUrl} placeholder="https://glints.com" onChange={(e) => set('siteUrl', e.target.value)} />
            </Field>
            <Field label="URL feed (JSON)" hint="Endpoint yang ditarik sync. Harus https:// di server produksi.">
              <Input type="url" inputMode="url" value={form.feedUrl} placeholder="https://api.contoh.com/v1/jobs" onChange={(e) => set('feedUrl', e.target.value)} />
            </Field>
            <Field label="Tipe adapter">
              <select className={selectClass} value="http-json" disabled>
                <option value="http-json">HTTP JSON feed (http-json)</option>
              </select>
            </Field>
            <Field label="Path daftar lowongan" hint="Letak array lowongan di respons, mis. data.jobs.">
              <Input value={form.itemsPath} onChange={(e) => set('itemsPath', e.target.value)} />
            </Field>
          </div>

          <h4 className="mb-2 mt-6 text-[13px] font-bold text-sk-navy">Pemetaan field</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ID lowongan *"><Input value={form.externalId} onChange={(e) => set('externalId', e.target.value)} /></Field>
            <Field label="Judul *"><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Perusahaan *"><Input value={form.company} onChange={(e) => set('company', e.target.value)} /></Field>
            <Field label="URL lamaran *"><Input value={form.applicationUrl} onChange={(e) => set('applicationUrl', e.target.value)} /></Field>
            <Field label="Lokasi"><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
            <Field label="Tipe kerja"><Input value={form.employmentType} placeholder="employment_type" onChange={(e) => set('employmentType', e.target.value)} /></Field>
            <Field label="Mode kerja"><Input value={form.workMode} placeholder="work_mode" onChange={(e) => set('workMode', e.target.value)} /></Field>
            <Field label="Skill wajib"><Input value={form.requiredSkills} placeholder="skills" onChange={(e) => set('requiredSkills', e.target.value)} /></Field>
            <Field label="Tanggal posting"><Input value={form.postedAt} placeholder="posted_at" onChange={(e) => set('postedAt', e.target.value)} /></Field>
          </div>

          <h4 className="mb-2 mt-6 text-[13px] font-bold text-sk-navy">Autentikasi (opsional)</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nama variabel env token" hint="Contoh GLINTS_API_TOKEN. Kosongkan untuk feed publik.">
              <Input value={form.credentialEnvVar} placeholder="GLINTS_API_TOKEN" onChange={(e) => set('credentialEnvVar', e.target.value.toUpperCase())} />
            </Field>
            <Field label="Header"><Input value={form.authHeader} disabled={!form.credentialEnvVar.trim()} onChange={(e) => set('authHeader', e.target.value)} /></Field>
            <Field label="Awalan nilai"><Input value={form.authScheme} disabled={!form.credentialEnvVar.trim()} onChange={(e) => set('authScheme', e.target.value)} /></Field>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Interval sync (menit)"><Input type="number" min={15} max={10080} value={form.syncIntervalMinutes} onChange={(e) => set('syncIntervalMinutes', e.target.value)} /></Field>
            <div className="grid content-end gap-2 text-[13px] text-sk-body">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.activate} onChange={(e) => set('activate', e.target.checked)} />
                Aktifkan sumber sekarang
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.activate && form.syncNow} disabled={!form.activate} onChange={(e) => set('syncNow', e.target.checked)} />
                Langsung tarik lowongan pertama
              </label>
            </div>
          </div>

          <div className="mt-4">
            <Field label="Alasan (tercatat di audit log)">
              <Textarea rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
            </Field>
          </div>

          {error && <p role="alert" className="mt-4 text-sm text-sk-error">{error}</p>}
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={close} disabled={busy}>Batal</Button>
            <Button onClick={submit} loading={busy}>Simpan sumber</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
