import { cn } from '@/lib/cn';

type CoverKind = 'data' | 'product' | 'design' | 'ml' | 'growth' | 'systems' | 'default';

/** Division name/slug → fallback visual, mirroring the Stitch cover templates. */
export function coverKindFor(category: string): CoverKind {
  const hay = category.toLowerCase();
  if (hay.includes('system') || hay.includes('token')) return 'systems';
  if (hay.includes('science') || hay.includes('machine') || hay.includes(' ml') || hay.startsWith('ml')) return 'ml';
  if (hay.includes('growth') || hay.includes('b2b') || hay.includes('onboard') || hay.includes('funnel') || hay.includes('checkout'))
    return 'growth';
  if (hay.includes('product') || hay.includes('pos') || hay.includes('kasir') || hay.includes('rice')) return 'product';
  if (hay.includes('ux') || hay.includes('design') || hay.includes('mood') || hay.includes('mental') || hay.includes('figma'))
    return 'design';
  if (hay.includes('data') || hay.includes('analy') || hay.includes('stok') || hay.includes('ritel') || hay.includes('sql'))
    return 'data';
  return 'default';
}

function Fallback({ kind, label }: { kind: CoverKind; label: string }) {
  const wrap = 'flex h-full w-full flex-col justify-between gap-2 p-3';
  if (kind === 'data') {
    return (
      <div className={wrap} aria-hidden>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-sk-blue">{label}</div>
        <svg viewBox="0 0 200 60" className="h-14 w-full" role="presentation">
          <g stroke="#CBD5E1" strokeWidth="1">
            <line x1="0" y1="15" x2="200" y2="15" />
            <line x1="0" y1="30" x2="200" y2="30" />
            <line x1="0" y1="45" x2="200" y2="45" />
          </g>
          <path d="M0 45 C 25 42, 35 25, 60 28 S 95 45, 115 22 S 150 8, 165 30 S 185 55, 200 20" fill="none" stroke="#1D4ED8" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="115" cy="22" r="4" fill="#1D4ED8" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
    );
  }
  if (kind === 'product') {
    const cells = [
      { k: 'Reach', v: '4.8k' },
      { k: 'Impact', v: '3.0' },
      { k: 'Conf.', v: '90%' },
      { k: 'RICE', v: '86.4', hot: true },
    ];
    return (
      <div className={wrap} aria-hidden>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-sk-blue">{label}</div>
        <div className="grid grid-cols-4 gap-1.5">
          {cells.map((c) => (
            <div key={c.k} className={cn('rounded-md border px-1 py-1.5 text-center', c.hot ? 'border-sk-blue bg-sk-blue text-white' : 'border-sk-border bg-white')}>
              <div className={cn('font-mono text-[8px] uppercase', c.hot ? 'text-white/80' : 'text-sk-muted')}>{c.k}</div>
              <div className="text-[12px] font-extrabold">{c.v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === 'design') {
    return (
      <div className={wrap} aria-hidden>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-sk-blue">{label}</div>
        <div className="rounded-md border border-sk-border bg-white px-2.5 py-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-sk-navy">
            <span>Mood Check-in:</span>
            <span aria-hidden>😊</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sk-border">
              <span className="block h-full w-[78%] rounded-full bg-sk-blue" />
            </span>
            <span className="font-mono text-sk-blue">78%</span>
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'ml') {
    return (
      <div className={wrap} aria-hidden>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-sk-blue">{label}</div>
        <div className="flex items-end justify-between rounded-md border border-sk-border bg-white px-2.5 py-2">
          <div>
            <div className="font-mono text-[8.5px] uppercase text-sk-muted">XGBoost ROC-AUC</div>
            <div className="text-[19px] font-extrabold text-sk-blue">0.914</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[8.5px] uppercase text-sk-muted">Precision Lift</div>
            <div className="text-[13px] font-extrabold text-sk-blue">+28.4%</div>
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'growth') {
    const steps = [
      { k: 'Step 1', v: '100%' },
      { k: 'KYC', v: '38%' },
      { k: 'Target A/B', v: '65%', hot: true },
    ];
    return (
      <div className={wrap} aria-hidden>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-sk-blue">{label}</div>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s.k} className="flex flex-1 items-center gap-1">
              <div className={cn('flex-1 rounded-md border px-1 py-1.5 text-center', s.hot ? 'border-sk-blue bg-sk-blue-tint' : 'border-sk-border bg-white')}>
                <div className="font-mono text-[8px] uppercase text-sk-muted">{s.k}</div>
                <div className="text-[12px] font-extrabold text-sk-navy">{s.v}</div>
              </div>
              {i < steps.length - 1 && <span className="text-[10px] text-sk-muted">→</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === 'systems') {
    return (
      <div className={wrap} aria-hidden>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-sk-blue">{label}</div>
        <div className="flex items-center justify-between rounded-md border border-sk-border bg-white px-2.5 py-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-[4px] bg-sk-blue" />
            <span className="font-mono text-[11px] text-sk-navy">--color-primary-600</span>
          </div>
          <span className="rounded border border-sk-border bg-sk-bg px-1.5 py-0.5 font-mono text-[10px] font-bold text-sk-navy">AAA 7.8:1</span>
        </div>
      </div>
    );
  }
  return (
    <div className={wrap} aria-hidden>
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-sk-blue">{label}</div>
      <svg viewBox="0 0 200 56" className="h-14 w-full" role="presentation">
        <circle cx="170" cy="14" r="18" fill="none" stroke="#246BFD" strokeWidth="2" opacity="0.5" />
        <circle cx="170" cy="14" r="7" fill="#246BFD" opacity="0.25" />
        <line x1="0" y1="44" x2="140" y2="44" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <line x1="0" y1="30" x2="90" y2="30" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <rect x="0" y="8" width="52" height="10" rx="2" fill="#1D4ED8" opacity="0.85" />
      </svg>
    </div>
  );
}

interface ProjectCoverProps {
  slug: string;
  title: string;
  category: string;
  coverImageUrl?: string | null;
  className?: string;
}

/** Primary card CTA label follows the division's output type (never hardcoded to one label). */
export function coverCtaLabel(category: string): string {
  switch (coverKindFor(category)) {
    case 'product':
      return 'Template PRD';
    case 'design':
      return 'Figma Kit';
    case 'ml':
      return 'Brief & Dataset';
    case 'growth':
      return 'Brief & Template';
    case 'systems':
      return 'Token Sheet';
    default:
      return 'Buka Brief';
  }
}

/**
 * Card header visual: AI-generated cover when the automation produced one,
 * otherwise a per-division data-viz fallback block (pure CSS/SVG, no fetch).
 */
export function ProjectCover({ slug, title, category, coverImageUrl, className }: ProjectCoverProps) {  return (
    <div className={cn('relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-sk-border bg-[#EFF4FF]', className)}>
      {coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Fallback kind={coverKindFor(category)} label={category || slug} />
      )}
      <span className="sr-only">{title}</span>
    </div>
  );
}
