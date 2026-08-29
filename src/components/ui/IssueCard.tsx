import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { ArrowRight, AlertCircle } from 'lucide-react';
import type { CVIssue } from '@/types/cv';

const priorityLabel: Record<CVIssue['priority'], string> = {
  high: 'HIGH IMPACT',
  medium: 'MEDIUM',
  low: 'LOW',
};

const priorityTone: Record<CVIssue['priority'], 'danger' | 'warning' | 'neutral'> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

interface IssueCardProps {
  issue: CVIssue;
}

export function IssueCard({ issue }: IssueCardProps) {
  return (
    <Card padding="lg" className="h-full">
      <div className="flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-soft)] text-[13px] font-bold text-[var(--color-ink-primary)]">
          {issue.rank}
        </div>
        <Badge variant={priorityTone[issue.priority]} size="sm">
          {priorityLabel[issue.priority]}
        </Badge>
      </div>
      <h4 className="mt-4 text-[15px] font-semibold text-[var(--color-ink-primary)] leading-snug">
        {issue.title}
      </h4>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
        {issue.explanation}
      </p>
      <div className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] p-3">
        <AlertCircle className="h-4 w-4 mt-0.5 text-[var(--color-brand-600)] shrink-0" />
        <p className="text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
          <span className="font-semibold text-[var(--color-ink-primary)]">Saran: </span>
          {issue.suggestion}
        </p>
      </div>
    </Card>
  );
}
