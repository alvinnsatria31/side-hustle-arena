'use client';

import { useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/primitives/Button';

type Scan = { id: string; fileName: string; score: number; createdAt: string };

export function CvHistoryView({ basePath }: { basePath: string }) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'anonymous' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setStatus('loading');
    void fetch('/api/cv-scan/history', { cache: 'no-store', credentials: 'same-origin', signal: abort.signal })
      .then(async response => {
        if (response.status === 401) { setScans([]); setStatus('anonymous'); return; }
        const payload = await response.json();
        if (!response.ok) throw new Error();
        setScans(payload.data.scans); setStatus('ready');
      }).catch(() => { if (!abort.signal.aborted) setStatus('error'); });
    return () => abort.abort();
  }, [refresh]);

  async function remove(id: string) {
    setDeleting(id); setError(null);
    try {
      const response = await fetch(`/api/cv-scan/history/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw new Error();
      setScans(current => current.filter(scan => scan.id !== id));
    } catch { setError('Hasil belum berhasil dihapus. Coba lagi.'); }
    finally { setDeleting(null); }
  }

  return (
    <section className="mt-10 rounded-2xl border border-sk-border bg-white p-5 sm:p-6" aria-labelledby="cv-history-title">
      <h2 id="cv-history-title" className="text-lg font-bold text-sk-navy">Riwayat CV privat</h2>
      <p className="mt-1 text-sm text-sk-muted">50 hasil terbaru yang kamu setujui untuk disimpan di akun.</p>
      {status === 'loading' && <p role="status" className="mt-4 text-sm text-sk-muted">Memuat riwayat…</p>}
      {status === 'anonymous' && <div className="mt-4"><p className="mb-3 text-sm text-sk-muted">Masuk untuk melihat dan menyimpan riwayat. Scan tanpa penyimpanan tetap bisa digunakan.</p><ButtonLink href={`/login?returnTo=${encodeURIComponent('/app/cv-scanner')}`} size="sm">Masuk</ButtonLink></div>}
      {status === 'error' && <div className="mt-4"><p role="alert" className="mb-3 text-sm text-sk-muted">Riwayat belum dapat dimuat.</p><Button size="sm" variant="ghost" onClick={() => setRefresh(n => n + 1)}>Coba lagi</Button></div>}
      {status === 'ready' && scans.length === 0 && <p className="mt-4 text-sm text-sk-muted">Belum ada hasil tersimpan. Centang persetujuan sebelum memulai scan.</p>}
      {status === 'ready' && <ul className="mt-4 divide-y divide-sk-border">{scans.map(scan => <li key={scan.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0"><p className="break-all text-sm font-semibold text-sk-navy">{scan.fileName}</p><p className="mt-1 text-xs text-sk-muted">{new Date(scan.createdAt).toLocaleString('id-ID')} · Skor {scan.score}/100</p></div>
        <div className="flex gap-2"><ButtonLink href={`${basePath}/result?historyId=${scan.id}`} size="sm" variant="ghost">Buka hasil</ButtonLink><Button size="sm" variant="ghost" disabled={deleting !== null} onClick={() => void remove(scan.id)} aria-label={`Hapus hasil ${scan.fileName}`}>{deleting === scan.id ? 'Menghapus…' : 'Hapus'}</Button></div>
      </li>)}</ul>}
      {error && <p role="alert" className="mt-3 text-sm text-sk-error">{error}</p>}
    </section>
  );
}
