import { Card } from '@/components/primitives/Card';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { Button } from '@/components/primitives/Button';
import { cn } from '@/lib/cn';

interface ScoreCardProps {
  score: number;
  statusLabel: string;
  summary: string;
  primaryCta: { label: string; onClick?: () => void; href?: string };
  secondaryCta?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}

function scoreTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

export function ScoreCard({
  score,
  statusLabel,
  summary,
  primaryCta,
  secondaryCta,
  className,
}: ScoreCardProps) {
  const tone = scoreTone(score);
  return (
    <Card variant="default" padding="xl" className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-tertiary)]">
          Skor CV Kamu
        </span>
        <StatusBadge label={statusLabel} tone={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'danger'} />
      </div>

      <div className="mt-5 flex items-end gap-3">
        <span className="text-[64px] leading-none font-bold text-[var(--color-ink-primary)] tracking-[-0.03em]">
          {score}
        </span>
        <span className="pb-2 text-[18px] font-medium text-[var(--color-ink-tertiary)]">/ 100</span>
      </div>

      <div className="mt-5">
        <ProgressBar value={score} color="brand" size="lg" />
      </div>

      <p className="mt-5 text-[15px] leading-relaxed text-[var(--color-ink-secondary)] max-w-md">
        {summary}
      </p>

      <div className="mt-7 flex flex-wrap gap-2">
        {primaryCta.href ? (
          <a href={primaryCta.href}>
            <Button variant="primary">{primaryCta.label}</Button>
          </a>
        ) : (
          <Button onClick={primaryCta.onClick} variant="primary">
            {primaryCta.label}
          </Button>
        )}
        {secondaryCta &&
          (secondaryCta.href ? (
            <a href={secondaryCta.href}>
              <Button variant="secondary">{secondaryCta.label}</Button>
            </a>
          ) : (
            <Button onClick={secondaryCta.onClick} variant="secondary">
              {secondaryCta.label}
            </Button>
          ))}
      </div>
    </Card>
  );
}
