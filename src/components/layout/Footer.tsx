import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { WHATSAPP_SUPPORT_URL } from './FloatingWhatsApp';

const PRODUCT_LINKS = [
  { label: 'Side Hustle Arena', href: '/arena' },
  { label: 'Career Report', href: '/app/career-report' },
];

const EXPLORE_LINKS = [
  { label: 'Proyek Minggu Ini', href: '/arena/projects' },
  { label: 'Sorotan Mingguan', href: '/arena/showcase' },
  { label: 'Masuk / Daftar', href: '/login' },
];

/** Shared public footer — logical navigation only. */
export function Footer() {
  return (
    <footer className="border-t border-sk-border bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandLogo />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-sk-muted">
            Kerjakan proyek nyata, dapatkan penilaian, dan tunjukkan hasil kerjamu.
          </p>
        </div>

        <nav aria-label="Produk">
          <h4 className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sk-muted">Produk</h4>
          <ul className="flex flex-col gap-2.5 text-[13px] font-medium text-sk-body">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="transition-colors hover:text-sk-blue">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Jelajahi">
          <h4 className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sk-muted">Jelajahi</h4>
          <ul className="flex flex-col gap-2.5 text-[13px] font-medium text-sk-body">
            {EXPLORE_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="transition-colors hover:text-sk-blue">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h4 className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sk-muted">Tentang</h4>
          <p className="text-[13px] leading-relaxed text-sk-body">
            Sekolah Karir membantumu menunjukkan kemampuan lewat proyek nyata, penilaian, dan hasil kerja yang bisa kamu bagikan.
          </p>
          <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-[13px] font-semibold leading-relaxed text-sk-blue hover:underline">
            Jika mengalami kendala, hubungi WhatsApp CS: +62 851-1730-4579
          </a>
        </div>
      </div>

      <div className="border-t border-sk-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5">
          <p className="font-mono text-[11px] text-sk-muted">© 2026 SEKOLAH KARIR</p>
          <p className="font-mono text-[11px] text-sk-muted">LATIH KEMAMPUAN · TUNJUKKAN HASIL · BUKA PELUANG</p>
        </div>
      </div>
    </footer>
  );
}
