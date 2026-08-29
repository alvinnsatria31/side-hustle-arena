import { Card } from '@/components/primitives/Card';
import { Check, Plus } from 'lucide-react';
import type { KeywordMatch } from '@/types/cv';

interface KeywordMatchCardProps {
  data: KeywordMatch;
  className?: string;
}

export function KeywordMatchCard({ data, className }: KeywordMatchCardProps) {
  return (
    <Card padding="lg" className={className}>
      <div className="flex items-center justify-between">
        <h3 className="text-[18px] font-semibold text-[var(--color-ink-primary)]">Keyword Match</h3>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[24px] font-bold text-[var(--color-brand-600)] tabular-nums">
            {data.score}
          </span>
          <span className="text-[13px] text-[var(--color-ink-tertiary)]">%</span>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-[var(--color-ink-tertiary)]">
        Berdasarkan Job Description yang kamu tambahkan.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-ink-tertiary)]">
            Ditemukan
          </h4>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.found.map((kw) => (
              <li
                key={kw}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-pill)] bg-[var(--color-success-soft)] text-[12px] font-semibold text-[var(--color-success)]"
              >
                <Check className="h-3.5 w-3.5" />
                {kw}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-ink-tertiary)]">
            Belum Ada · Rekomendasi
          </h4>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.missing.map((kw) => (
              <li
                key={kw}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-pill)] bg-[var(--color-warning-soft)] text-[12px] font-semibold text-[var(--color-warning)]"
              >
                <Plus className="h-3.5 w-3.5" />
                {kw}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
