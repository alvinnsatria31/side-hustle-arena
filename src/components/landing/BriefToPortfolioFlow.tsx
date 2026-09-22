import { cn } from '@/lib/cn';

/**
 * Brief → hasil kerja → bukti, drawn rather than described.
 *
 * The benefits section is the one place on this page where a claim needs a
 * picture: "hasil kerjamu jadi bukti" is abstract until someone can see the
 * three objects it passes through. Three panels, drawn from the same tokens as
 * the rest of the page, so the illustration reads as part of the product and
 * not as clip art dropped into it.
 *
 * Horizontal on desktop, stacked on phones with the arrows rotated — an
 * arrow pointing right between two vertically stacked panels is the usual way
 * this breaks at narrow widths.
 */
function Panel({
  step,
  title,
  caption,
  children,
}: {
  step: string;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-[6px] bg-sk-blue-tint font-mono text-[10px] font-bold text-sk-blue-700">
          {step}
        </span>
        <span className="text-[13px] font-bold tracking-[-0.02em] text-sk-navy">{title}</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-[var(--radius-sk-md)] border border-sk-border bg-sk-bg p-3">
        {children}
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-sk-muted">{caption}</p>
    </div>
  );
}

function Connector() {
  return (
    <span
      aria-hidden
      className="grid flex-none place-items-center self-center text-sk-blue-tint-border max-md:rotate-90"
    >
      <span className="block h-px w-5 bg-current max-md:h-5 max-md:w-px" />
    </span>
  );
}

export function BriefToPortfolioFlow({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 md:flex-row md:items-stretch md:gap-3', className)}>
      <Panel step="1" title="Brief" caption="Satu kebutuhan nyata, lengkap dengan rubrik penilaiannya.">
        <svg viewBox="0 0 120 64" aria-hidden focusable="false" className="h-auto w-full">
          <rect x="10" y="4" width="70" height="56" rx="6" fill="#fff" stroke="#07152d" strokeOpacity="0.1" />
          <rect x="18" y="13" width="38" height="5" rx="2.5" fill="#07152d" fillOpacity="0.18" />
          <rect x="18" y="24" width="54" height="4" rx="2" fill="#07152d" fillOpacity="0.08" />
          <rect x="18" y="33" width="46" height="4" rx="2" fill="#07152d" fillOpacity="0.08" />
          <rect x="18" y="42" width="50" height="4" rx="2" fill="#07152d" fillOpacity="0.08" />
          <g stroke="#0f9d58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M88 18 l4 4 l7 -8" />
            <path d="M88 34 l4 4 l7 -8" />
            <path d="M88 50 l4 4 l7 -8" />
          </g>
        </svg>
      </Panel>

      <Connector />

      <Panel step="2" title="Hasil kerja" caption="Kamu kerjakan di workspace, lalu unggah hasilnya.">
        <svg viewBox="0 0 120 64" aria-hidden focusable="false" className="h-auto w-full">
          <rect x="8" y="6" width="104" height="52" rx="6" fill="#fff" stroke="#07152d" strokeOpacity="0.1" />
          <line x1="8" y1="20" x2="112" y2="20" stroke="#07152d" strokeOpacity="0.08" />
          <circle cx="17" cy="13" r="2.2" fill="#07152d" fillOpacity="0.14" />
          <circle cx="25" cy="13" r="2.2" fill="#07152d" fillOpacity="0.14" />
          <path
            d="M18 50 L34 42 L48 45 L62 33 L76 28 L92 22 L102 18 L102 52 L18 52 Z"
            fill="#246bfd"
            fillOpacity="0.12"
          />
          <polyline
            points="18,50 34,42 48,45 62,33 76,28 92,22 102,18"
            fill="none"
            stroke="#246bfd"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="102" cy="18" r="2.8" fill="#246bfd" />
        </svg>
      </Panel>

      <Connector />

      <Panel step="3" title="Bukti kerja" caption="Hasil dan skill-nya kamu pasang sendiri di profilmu.">
        <svg viewBox="0 0 120 64" aria-hidden focusable="false" className="h-auto w-full">
          <rect x="18" y="4" width="84" height="56" rx="6" fill="#fff" stroke="#07152d" strokeOpacity="0.1" />
          <circle cx="34" cy="20" r="8" fill="#246bfd" fillOpacity="0.16" />
          <rect x="48" y="14" width="40" height="5" rx="2.5" fill="#07152d" fillOpacity="0.16" />
          <rect x="48" y="24" width="28" height="4" rx="2" fill="#07152d" fillOpacity="0.08" />
          <rect x="28" y="38" width="64" height="4" rx="2" fill="#07152d" fillOpacity="0.08" />
          <rect x="28" y="48" width="22" height="7" rx="3.5" fill="#246bfd" fillOpacity="0.28" />
          <rect x="54" y="48" width="18" height="7" rx="3.5" fill="#246bfd" fillOpacity="0.2" />
          <rect x="76" y="48" width="16" height="7" rx="3.5" fill="#246bfd" fillOpacity="0.14" />
        </svg>
      </Panel>
    </div>
  );
}
