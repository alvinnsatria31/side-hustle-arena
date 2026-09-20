import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { footerColumns } from '@/components/layout/nav-links';
import { ExternalMark, NavAnchor, NewBadge, PROMO_PILL } from '@/components/layout/NavPromo';
import { cn } from '@/lib/cn';
import { WHATSAPP_SUPPORT_URL } from './FloatingWhatsApp';

/**
 * Shared public footer — logical navigation only.
 *
 * The columns are built from the same lists the navbars read, so a feature
 * that is switched off cannot linger down here after it has gone from the bar
 * above. That drift is the reason this file no longer keeps its own copy of
 * the links.
 */
export function Footer() {
  const columns = footerColumns();

  return (
    <footer className="border-t border-sk-border bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandLogo />
          <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-sk-muted">
            Kompetisi proyek mingguan. Kerjakan brief nyata, dapatkan penilaian per kriteria, dan
            tunjukkan hasil kerjamu.
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.heading} aria-label={column.heading}>
            <h4 className="mb-4 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sk-faint">
              {column.heading}
            </h4>
            <ul className="flex flex-col gap-3 text-[13.5px] font-medium text-sk-body">
              {column.links.map((link) => (
                <li key={link.href}>
                  <NavAnchor
                    link={link}
                    className={cn(
                      'transition-colors',
                      link.highlight
                        ? cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold duration-200',
                            PROMO_PILL,
                          )
                        : 'hover:text-sk-blue',
                    )}
                  >
                    {link.label}
                    {link.highlight && <NewBadge />}
                    {link.external && <ExternalMark />}
                  </NavAnchor>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* Anchor target for the landing page's "Kontak" link. `scroll-mt`
            clears the fixed header, which would otherwise cover the heading
            the visitor just asked to be taken to. */}
        <div id="kontak" className="scroll-mt-28">
          <h4 className="mb-4 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sk-faint">
            Bantuan
          </h4>
          <p className="text-[13.5px] leading-relaxed text-sk-body">
            Ada kendala saat mengerjakan atau mengumpulkan? Hubungi kami langsung.
          </p>
          <a
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-[13.5px] font-semibold leading-relaxed text-sk-blue hover:underline"
          >
            WhatsApp CS · +62 851-1730-4579
          </a>
        </div>
      </div>

      <div className="border-t border-sk-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5">
          <p className="font-mono text-[11px] text-sk-faint">© 2026 SEKOLAH KARIR</p>
          <p className="font-mono text-[11px] text-sk-faint">KERJAKAN · DINILAI · TUNJUKKAN</p>
        </div>
      </div>
    </footer>
  );
}
