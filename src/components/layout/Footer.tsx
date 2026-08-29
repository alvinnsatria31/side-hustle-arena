import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8 py-10 grid gap-8 md:grid-cols-4">
        <div>
          <BrandLogo size="md" />
          <p className="mt-3 text-[13px] text-[var(--color-ink-tertiary)] max-w-xs">
            Platform karier yang membantu mahasiswa dan profesional awal menghubungkan teori dengan pengalaman industri nyata.
          </p>
        </div>
        <div>
          <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-ink-tertiary)]">Produk</h4>
          <ul className="mt-3 space-y-2">
            <li><Link href="/cv-scanner" className="text-[14px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]">CV Scanner</Link></li>
            <li><Link href="/arena" className="text-[14px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]">Side Hustle Arena</Link></li>
            <li><Link href="/arena/showcase" className="text-[14px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]">Showcase</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-ink-tertiary)]">Karir App</h4>
          <ul className="mt-3 space-y-2">
            <li><Link href="/app" className="text-[14px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]">Beranda</Link></li>
            <li><Link href="/app/report" className="text-[14px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]">Career Report</Link></li>
            <li><Link href="/app/portfolio" className="text-[14px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]">Portfolio</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-ink-tertiary)]">Tentang</h4>
          <ul className="mt-3 space-y-2">
            <li><span className="text-[14px] text-[var(--color-ink-tertiary)]">Sekolah Karir</span></li>
            <li><span className="text-[14px] text-[var(--color-ink-tertiary)]">v1.0 · demo</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8 h-14 flex items-center justify-between text-[12px] text-[var(--color-ink-tertiary)]">
          <span>© 2026 Sekolah Karir</span>
          <span>Dibuat untuk membantu karirmu.</span>
        </div>
      </div>
    </footer>
  );
}
