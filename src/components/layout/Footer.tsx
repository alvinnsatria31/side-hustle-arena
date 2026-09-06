import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { isCvScannerEnabled } from '@/lib/cv-scan-limits';

const PRODUCT_LINKS_ALL = [
  { label: 'CV Scanner', href: '/cv-scanner' },
  { label: 'Side Hustle Arena', href: '/arena' },
  { label: 'Career Report', href: '/app/career-report' },
  { label: 'Jobs', href: '/app/jobs' },
];

/** The CV Scanner stays out of navigation until its backend is switched on. */
const PRODUCT_LINKS = PRODUCT_LINKS_ALL.filter((item) => !item.href.includes('/cv-scanner') || isCvScannerEnabled());

const EXPLORE_LINKS = [
  { label: 'Project Minggu Ini', href: '/arena/projects' },
  { label: 'Weekly Spotlight', href: '/arena/showcase' },
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
            Scan CV, kerjakan project dunia nyata, bangun bukti skill, dan temukan peluang kerja yang lebih relevan.
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
            Sekolah Karir membantu kamu pindah dari &ldquo;bisa&rdquo; ke &ldquo;terbukti bisa&rdquo; — lewat project nyata, feedback, dan bukti skill.
          </p>
        </div>
      </div>

      <div className="border-t border-sk-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5">
          <p className="font-mono text-[11px] text-sk-muted">© 2026 SEKOLAH KARIR · CAREER ECOSYSTEM</p>
          <p className="font-mono text-[11px] text-sk-muted">BANGUN SKILL · BUKTIKAN KEMAMPUAN · MAJUKAN KARIRMU</p>
        </div>
      </div>
    </footer>
  );
}
