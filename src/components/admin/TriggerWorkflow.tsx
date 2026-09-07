'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Rocket } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { launchAdminProjectRun, type AdminLaunchResult } from '@/lib/admin-client';
import { buildAdminLaunchRequest } from '@/lib/admin-launch-form';
import { toJakartaInput } from '@/lib/jakarta-time';

const stepLabels: Record<string, string> = { week: 'Siapkan minggu', generate: 'Buat project', approve: 'Setujui project', publish: 'Publikasikan' };

export function TriggerWorkflow() {
  const [form, setForm] = useState(() => ({ openNow: true, opensAt: '',
    deadline: `${toJakartaInput(new Date(Date.now() + 4 * 86_400_000).toISOString()).slice(0, 10)}T23:59`,
    title: '', reason: '', publish: false }));
  const busy = useRef(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState<AdminLaunchResult | null>(null);
  const published = result?.steps.some(step => step.step === 'publish' && Number(step.detail.published) > 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || published || uncertain) return;
    setError(null);
    let dispatched = false;
    try {
      const request = buildAdminLaunchRequest(form);
      busy.current = true;
      setRunning(true);
      dispatched = true;
      setResult(await launchAdminProjectRun({ ...request, ...(result?.weekId ? { weekId: result.weekId } : {}) }));
    } catch (cause) {
      // A failed response does not prove the backend did not create/publish a week.
      // Never turn an uncertain request into a fresh release on a second click.
      if (dispatched) setUncertain(true);
      setError(cause instanceof Error ? cause.message : 'Workflow gagal dijalankan.');
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }

  return <div className="max-w-3xl">
    <Card className="mb-5 border-sk-blue-tint-border bg-sk-blue-wash p-5">
      <p className="font-semibold text-sk-navy">Project bisa dirilis tanpa menunggu Senin.</p>
      <p className="mt-2 text-sm leading-relaxed text-sk-body">Trigger manual membuat rilis tambahan. Jadwal mingguan tetap mengikuti konfigurasi otomatis yang sudah ada; tombol ini tidak mengubah atau mematikannya.</p>
    </Card>
    <Card className="p-6">
      <form onSubmit={submit}>
        <fieldset disabled={running || Boolean(published) || uncertain} className="space-y-5 disabled:opacity-70">
          <legend className="mb-4 text-lg font-bold text-sk-navy">Jalankan workflow project</legend>
          <p className="text-sm text-sk-muted">Buat project untuk setiap divisi aktif, lalu pilih simpan sebagai preview atau langsung publikasikan.</p>
          <label className="block text-sm font-semibold text-sk-navy">Judul rilis (opsional)
            <Input className="mt-2" maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Sprint latihan tambahan" />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-sk-body">
            <input type="checkbox" checked={form.openNow} onChange={e => setForm({ ...form, openNow: e.target.checked })} disabled={Boolean(result?.weekId)} /> Buka sekarang
          </label>
          {!form.openNow && <label className="block text-sm font-semibold text-sk-navy">Waktu buka (WIB)
            <Input className="mt-2" type="datetime-local" required value={form.opensAt} disabled={Boolean(result?.weekId)} onChange={e => setForm({ ...form, opensAt: e.target.value })} />
          </label>}
          <label className="block text-sm font-semibold text-sk-navy">Deadline submission (WIB)
            <Input className="mt-2" type="datetime-local" required value={form.deadline} disabled={Boolean(result?.weekId)} onChange={e => setForm({ ...form, deadline: e.target.value })} />
          </label>
          <label className="block text-sm font-semibold text-sk-navy">Alasan trigger
            <Textarea className="mt-2" required maxLength={1000} rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Contoh: membuka latihan tambahan untuk peserta baru" />
            <span className="mt-2 block text-xs font-normal text-sk-muted">Alasan dan admin yang menjalankan tercatat di audit log.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-sk-body">
            <input className="mt-1" type="checkbox" checked={form.publish} onChange={e => setForm({ ...form, publish: e.target.checked })} />
            <span><strong>Setujui dan publikasikan langsung</strong><span className="mt-1 block text-xs text-sk-muted">Jika dipilih, hasil generator langsung disetujui tanpa menunggu preview. Publikasi tetap mengikuti waktu buka. Jika tidak, periksa hasilnya di menu Project.</span></span>
          </label>
          <Button type="submit" loading={running} disabled={!form.reason.trim()} iconLeft={<Rocket size={16} aria-hidden />}>
            {result?.weekId ? 'Lanjutkan workflow ini' : 'Trigger workflow sekarang'}
          </Button>
        </fieldset>
      </form>
      {running && <p role="status" className="mt-4 text-sm text-sk-muted">Workflow sedang berjalan. Tunggu sampai hasil setiap tahap muncul.</p>}
      {error && <p role="alert" className="mt-4 text-sm text-sk-error">{error}</p>}
      {uncertain && <p className="mt-3 text-sm text-sk-body">Permintaan sudah dikirim, tetapi status akhirnya belum dapat dipastikan. Periksa rilis yang mungkin sudah dibuat sebelum menjalankan workflow baru. <Link href="/app/admin/projects" className="font-semibold text-sk-blue underline">Periksa project</Link>.</p>}
      {result && <div role="status" className="mt-6 border-t border-sk-border pt-5">
        <h2 className="font-bold text-sk-navy">{published ? 'Project sudah dipublikasikan' : 'Hasil workflow'} · {result.weekCode}</h2>
        <ol className="my-4 space-y-2 text-sm text-sk-body">{result.steps.map(step => <li key={step.step}>
          <strong>{stepLabels[step.step] ?? step.step}:</strong> {step.ok ? 'Selesai' : 'Perlu ditinjau'}
          {typeof step.detail.message === 'string' && <p>{step.detail.message}</p>}
          {typeof step.detail.skipped === 'string' && <p>{step.detail.skipped}</p>}
        </li>)}</ol>
        <Link href="/app/admin/projects" className="text-sm font-semibold text-sk-blue underline">Lihat project dan lanjutkan pemeriksaan</Link>
        {result.weekId && <p className="mt-2 text-xs text-sk-muted">Melanjutkan workflow memakai minggu yang sama. Waktu buka dan deadline tetap mengikuti rilis pertama.</p>}
      </div>}
    </Card>
  </div>;
}
