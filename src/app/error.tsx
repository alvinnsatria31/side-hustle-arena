'use client';

import { useEffect } from 'react';
import { Button } from '@/components/primitives/Button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sk-bg px-6">
      <div className="w-full max-w-md rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-9 text-center shadow-sk-lg">
        <div className="mx-auto mb-[18px] flex h-16 w-16 items-center justify-center rounded-[var(--radius-sk-xl)] bg-sk-error-tint text-sk-error">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M12 8v5m0 3v.5M4 20h16L12 4 4 20z" />
          </svg>
        </div>
        <h1 className="mb-2 text-[19px] font-extrabold tracking-[-0.01em] text-sk-navy">Ada yang tidak beres.</h1>
        <p className="mb-6 text-[13px] leading-relaxed text-sk-muted">
          Terjadi kendala saat menampilkan halaman ini. Coba muat ulang — datamu tetap tersimpan di browser.
        </p>
        <div className="flex justify-center gap-2.5">
          <Button onClick={reset}>Coba Lagi</Button>
          <Button variant="ghost" onClick={() => (window.location.href = '/')}>
            Kembali ke Beranda
          </Button>
        </div>
      </div>
    </div>
  );
}
