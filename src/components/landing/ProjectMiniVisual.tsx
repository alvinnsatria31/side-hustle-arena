import { cn } from '@/lib/cn';

/**
 * The mini visual on a project card.
 *
 * A card that says "Data" over a wall of text does not look like work; the
 * point of these is that a brief should be recognisable as a kind of job
 * before the title is read. Each motif is drawn here rather than fetched, so
 * a card has a visual even when the brief has no generated cover, and so the
 * page costs no extra requests above the fold.
 *
 * Nothing here carries a number, a label or an axis value. These sit on cards
 * whose other fields are read from the live week, and a plausible-looking
 * "+28%" beside a real deadline would be read as part of that data. They are
 * schematics of the shape of the work, and that is all they claim to be.
 *
 * Motifs follow the same division reading `coverHintForDivision` uses for
 * generated cover art, so a card and its cover agree about what a division is.
 */
export type MiniVisualMotif = 'chart' | 'metric' | 'ui' | 'funnel' | 'tokens' | 'grid';

export function motifForDivision(divisionSlug: string, divisionName: string): MiniVisualMotif {
  const hay = `${divisionSlug} ${divisionName}`.toLowerCase();
  if (hay.includes('system') || hay.includes('token') || hay.includes('brand')) return 'tokens';
  if (hay.includes('ux') || hay.includes('design') || hay.includes('desain')) return 'ui';
  if (
    hay.includes('growth') ||
    hay.includes('funnel') ||
    hay.includes('onboard') ||
    hay.includes('market') ||
    hay.includes('sales') ||
    hay.includes('checkout')
  )
    return 'funnel';
  if (hay.includes('product') || hay.includes('produk') || hay.includes('pos') || hay.includes('kasir')) return 'metric';
  if (
    hay.includes('data') ||
    hay.includes('analy') ||
    hay.includes('analis') ||
    hay.includes('sql') ||
    hay.includes('research') ||
    hay.includes('riset') ||
    hay.includes('science')
  )
    return 'chart';
  return 'grid';
}

/** Shared frame: hairline grid wash the motifs are drawn over. */
function Plate({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 320 180"
      role="presentation"
      aria-hidden
      focusable="false"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="sk-mini-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#246bfd" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#246bfd" stopOpacity="0" />
        </linearGradient>
        <pattern id="sk-mini-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1.4" fill="#07152d" fillOpacity="0.06" />
        </pattern>
      </defs>
      <rect width="320" height="180" fill="url(#sk-mini-dots)" />
      {children}
    </svg>
  );
}

/**
 * Data — a cohort curve over a faint grid.
 *
 * Nothing is drawn in the top 40 units of any motif: the card lays its
 * category badge over the top-left corner and its points badge over the
 * top-right, and a legend hiding behind a badge reads as a rendering bug.
 */
function ChartMotif() {
  return (
    <Plate>
      {[46, 82, 118].map((y) => (
        <line key={y} x1="28" x2="292" y1={y} y2={y} stroke="#07152d" strokeOpacity="0.07" strokeWidth="1" />
      ))}
      <path
        d="M28 132 L74 116 L120 122 L166 92 L212 74 L258 52 L292 44 L292 148 L28 148 Z"
        fill="url(#sk-mini-area)"
        className="opacity-80 transition-opacity duration-500 ease-out group-hover:opacity-100"
      />
      <polyline
        points="28,132 74,116 120,122 166,92 212,74 258,52 292,44"
        fill="none"
        stroke="#246bfd"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g className="transition-transform duration-500 ease-out [transform-box:fill-box] [transform-origin:center] group-hover:-translate-y-[3px]">
        <circle cx="292" cy="44" r="7" fill="#246bfd" fillOpacity="0.18" />
        <circle cx="292" cy="44" r="3.4" fill="#246bfd" />
      </g>
    </Plate>
  );
}

/** Product — score tiles beside a small trend bar. */
function MetricMotif() {
  const tiles = [
    { x: 28, h: 30 },
    { x: 118, h: 44 },
    { x: 208, h: 22 },
  ];
  return (
    <Plate>
      {tiles.map((tile, index) => (
        <g key={tile.x}>
          <rect
            x={tile.x}
            y="36"
            width="84"
            height="108"
            rx="12"
            fill="#ffffff"
            stroke="#07152d"
            strokeOpacity="0.09"
          />
          <rect x={tile.x + 14} y="52" width="34" height="6" rx="3" fill="#07152d" fillOpacity="0.16" />
          <rect
            x={tile.x + 14}
            y={128 - tile.h}
            width="16"
            height={tile.h}
            rx="5"
            fill={index === 1 ? '#246bfd' : '#246bfd'}
            fillOpacity={index === 1 ? 0.95 : 0.34}
            className="transition-transform duration-500 ease-out [transform-box:fill-box] [transform-origin:bottom] group-hover:scale-y-110"
          />
          <rect x={tile.x + 38} y="116" width="30" height="12" rx="4" fill="#07152d" fillOpacity="0.07" />
        </g>
      ))}
    </Plate>
  );
}

/** Design — a fragment of an interface, with a pointer over its primary action. */
function UiMotif() {
  return (
    <Plate>
      <rect x="26" y="24" width="268" height="132" rx="14" fill="#ffffff" stroke="#07152d" strokeOpacity="0.09" />
      <rect x="26" y="24" width="268" height="24" rx="14" fill="#f8fbf8" />
      <rect x="26" y="40" width="268" height="8" fill="#f8fbf8" />
      <line x1="26" y1="48" x2="294" y2="48" stroke="#07152d" strokeOpacity="0.08" />
      <rect x="40" y="62" width="58" height="80" rx="9" fill="#246bfd" fillOpacity="0.07" />
      {[70, 86, 102, 118].map((y) => (
        <rect key={y} x="50" y={y} width="38" height="6" rx="3" fill="#246bfd" fillOpacity="0.28" />
      ))}
      <rect x="112" y="64" width="112" height="8" rx="4" fill="#07152d" fillOpacity="0.16" />
      <rect x="112" y="80" width="160" height="6" rx="3" fill="#07152d" fillOpacity="0.09" />
      <rect x="112" y="94" width="138" height="6" rx="3" fill="#07152d" fillOpacity="0.09" />
      <rect
        x="112"
        y="114"
        width="74"
        height="26"
        rx="9"
        fill="#246bfd"
        className="transition-opacity duration-500 ease-out opacity-85 group-hover:opacity-100"
      />
      <rect x="126" y="124" width="46" height="6" rx="3" fill="#ffffff" fillOpacity="0.85" />
      <g className="transition-transform duration-500 ease-out [transform-box:fill-box] [transform-origin:center] group-hover:-translate-x-[6px] group-hover:translate-y-[4px]">
        <path d="M196 122 L196 146 L203 139 L208 150 L213 147 L208 137 L217 136 Z" fill="#07152d" fillOpacity="0.82" />
      </g>
    </Plate>
  );
}

/** Growth — a three-step funnel narrowing toward the target. */
function FunnelMotif() {
  const steps = [
    { y: 36, w: 232, o: 0.9 },
    { y: 78, w: 168, o: 0.6 },
    { y: 120, w: 104, o: 0.32 },
  ];
  return (
    <Plate>
      {steps.map((step, index) => (
        <g key={step.y}>
          <rect
            x={44 + index * 14}
            y={step.y}
            width={step.w}
            height="26"
            rx="9"
            fill="#246bfd"
            fillOpacity={step.o}
            className="transition-transform duration-500 ease-out [transform-box:fill-box] [transform-origin:left] group-hover:translate-x-[4px]"
          />
          {index < steps.length - 1 && (
            <line
              x1={60 + index * 14}
              y1={step.y + 26}
              x2={60 + index * 14}
              y2={step.y + 42}
              stroke="#07152d"
              strokeOpacity="0.14"
              strokeWidth="1.6"
              strokeDasharray="3 3"
            />
          )}
        </g>
      ))}
    </Plate>
  );
}

/** Design system — a token row with its hairline spec lines. */
function TokensMotif() {
  const swatches = ['#07152d', '#1a56d6', '#246bfd', '#4b8bff', '#50c8dc'];
  return (
    <Plate>
      {swatches.map((fill, index) => (
        <g
          key={fill}
          className="transition-transform duration-500 ease-out [transform-box:fill-box] [transform-origin:bottom] group-hover:-translate-y-[4px]"
          style={{ transitionDelay: `${index * 40}ms` }}
        >
          <rect x={30 + index * 54} y="38" width="44" height="60" rx="12" fill={fill} />
          <rect x={30 + index * 54} y="108" width="44" height="6" rx="3" fill="#07152d" fillOpacity="0.14" />
          <rect x={30 + index * 54} y="122" width="28" height="6" rx="3" fill="#07152d" fillOpacity="0.08" />
        </g>
      ))}
    </Plate>
  );
}

/** Anything else — an editorial composition rather than a blank card. */
function GridMotif() {
  return (
    <Plate>
      <rect x="30" y="34" width="112" height="112" rx="16" fill="#246bfd" fillOpacity="0.1" />
      <circle
        cx="200"
        cy="72"
        r="34"
        fill="none"
        stroke="#246bfd"
        strokeWidth="2.4"
        strokeOpacity="0.55"
        className="transition-transform duration-500 ease-out [transform-box:fill-box] [transform-origin:center] group-hover:scale-105"
      />
      <rect x="166" y="118" width="124" height="10" rx="5" fill="#07152d" fillOpacity="0.12" />
      <rect x="166" y="136" width="78" height="10" rx="5" fill="#07152d" fillOpacity="0.07" />
      <rect x="52" y="60" width="68" height="8" rx="4" fill="#246bfd" fillOpacity="0.45" />
      <rect x="52" y="78" width="46" height="8" rx="4" fill="#246bfd" fillOpacity="0.28" />
      <rect x="52" y="96" width="58" height="8" rx="4" fill="#246bfd" fillOpacity="0.18" />
    </Plate>
  );
}

const MOTIFS: Record<MiniVisualMotif, () => React.JSX.Element> = {
  chart: ChartMotif,
  metric: MetricMotif,
  ui: UiMotif,
  funnel: FunnelMotif,
  tokens: TokensMotif,
  grid: GridMotif,
};

export function ProjectMiniVisual({ motif, className }: { motif: MiniVisualMotif; className?: string }) {
  const Motif = MOTIFS[motif] ?? GridMotif;
  return (
    <div className={cn('h-full w-full bg-sk-blue-wash', className)}>
      <Motif />
    </div>
  );
}
