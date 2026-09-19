import { ButtonLink } from '@/components/primitives/Button';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-sk-bg px-6">
      <div className="ambient" aria-hidden />
      <div className="relative z-[1] w-full max-w-md rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-9 text-center shadow-sk-lg">
        <div className="mx-auto mb-5 flex w-fit justify-center">
          <BrandLogo />
        </div>
        <div className="mb-2 font-mono text-[56px] font-extrabold leading-none tracking-[-0.04em] text-sk-blue">404</div>
        <h1 className="mb-2 text-[20px] font-extrabold tracking-[-0.01em] text-sk-navy">Halaman tidak ditemukan.</h1>
        <p className="mb-6 text-[13px] leading-relaxed text-sk-muted">
          Halaman yang kamu cari tidak tersedia. Kamu bisa kembali ke beranda atau melihat proyek yang sedang dibuka.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <ButtonLink href="/">Kembali ke beranda</ButtonLink>
          <ButtonLink href="/arena/projects" variant="ghost">
            Lihat proyek minggu ini
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
