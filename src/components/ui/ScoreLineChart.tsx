import { cn } from '@/lib/cn';

export interface ScorePoint {
  weekLabel: string;
  score: number;
}

interface ScoreLineChartProps {
  data: ScorePoint[];
  className?: string;
}

export function ScoreLineChart({ data, className }: ScoreLineChartProps) {
  const width = 600;
  const height = 220;
  const padX = 36;
  const padY = 28;

  const minScore = 0;
  const maxScore = 100;
  const xStep = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  const toX = (i: number) => padX + i * xStep;
  const toY = (score: number) => {
    const ratio = (score - minScore) / (maxScore - minScore);
    return height - padY - ratio * (height - padY * 2);
  };

  // Build smooth path using cubic bezier
  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.score), ...d }));

  let pathD = '';
  let areaD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cpx1 = p0.x + (p1.x - p0.x) / 2;
      const cpx2 = p0.x + (p1.x - p0.x) / 2;
      pathD += ` C ${cpx1} ${p0.y} ${cpx2} ${p1.y} ${p1.x} ${p1.y}`;
    }
    areaD = `${pathD} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;
  }

  // Y-axis ticks
  const yTicks = [0, 50, 100];

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="Score progression chart"
      >
        <defs>
          <linearGradient id="sk-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid */}
        {yTicks.map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeDasharray={tick === 0 ? '0' : '4 4'}
                strokeWidth="1"
              />
              <text
                x={padX - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--color-ink-tertiary)"
                fontSize="10"
                fontWeight={500}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Area + line */}
        {areaD && <path d={areaD} fill="url(#sk-line-fill)" />}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points */}
        {points.map((p) => (
          <g key={p.weekLabel}>
            <circle
              cx={p.x}
              cy={p.y}
              r="5"
              fill="white"
              stroke="var(--color-brand-500)"
              strokeWidth="2.5"
            />
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              fill="var(--color-ink-primary)"
              fontSize="11"
              fontWeight={600}
            >
              {p.score}
            </text>
          </g>
        ))}

        {/* X labels */}
        {points.map((p) => (
          <text
            key={`xl-${p.weekLabel}`}
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            fill="var(--color-ink-tertiary)"
            fontSize="10"
            fontWeight={500}
          >
            {p.weekLabel}
          </text>
        ))}
      </svg>
    </div>
  );
}
