import { Card } from '@/components/primitives/Card';
import { ArrowUpRight } from 'lucide-react';
import type { Recommendation } from '@/types/cv';

interface RecommendationCardProps {
  recommendation: Recommendation;
  className?: string;
}

export function RecommendationCard({ recommendation, className }: RecommendationCardProps) {
  return (
    <Card padding="md" className={className}>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
          <ArrowUpRight className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-semibold text-[var(--color-ink-primary)] leading-snug">
            {recommendation.title}
          </h4>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-tertiary)]">
            {recommendation.description}
          </p>
          <button
            className="mt-3 text-[12.5px] font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)] inline-flex items-center gap-1"
            type="button"
          >
            {recommendation.cta}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
