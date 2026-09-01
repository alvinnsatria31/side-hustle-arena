import { cn } from '@/lib/cn';
import type { EvidenceLevel } from '@/types/cv';

const LEVEL_CONFIG: Record<EvidenceLevel, { label: string; chip: string; width: number }> = {
  kuat: { label: 'Kuat', chip: 'bg-sk-success-tint text-sk-success', width: 88 },
  cukup: { label: 'Cukup', chip: 'bg-sk-blue-tint text-sk-blue', width: 62 },
  kurang: { label: 'Kurang Bukti', chip: 'bg-sk-warning-tint text-sk-warning-ink', width: 38 },
  belum: { label: 'Belum Ada Evidence', chip: 'bg-sk-error-tint text-sk-error', width: 12 },
};

/** Career evidence row: skill + level + thin bar. */
export function EvidenceRow({ skill, level, note }: { skill: string; level: EvidenceLevel; note?: string }) {
  const config = LEVEL_CONFIG[level];
  return (
    <div className="grid grid-cols-[130px_1fr_auto] items-center gap-3 py-2.5 sm:grid-cols-[170px_1fr_auto] sm:gap-4">
      <div>
        <div className="text-[13.5px] font-semibold text-sk-navy">{skill}</div>
        {note && <div className="mt-0.5 hidden text-[11px] leading-snug text-sk-muted sm:block">{note}</div>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sk-track">
        <div
          className={cn(
            'h-full rounded-full',
            level === 'kuat' && 'bg-gradient-to-r from-sk-success to-sk-mint',
            level === 'cukup' && 'bg-gradient-to-r from-sk-blue to-sk-blue-400',
            level === 'kurang' && 'bg-gradient-to-r from-sk-warning to-[#f0a94c]',
            level === 'belum' && 'bg-sk-error/70',
          )}
          style={{ width: `${config.width}%` }}
        />
      </div>
      <span className={cn('rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold', config.chip)}>
        {config.label}
      </span>
    </div>
  );
}
