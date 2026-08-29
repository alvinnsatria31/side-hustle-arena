import { Card } from '@/components/primitives/Card';
import { CheckCircle2, ArrowUpCircle, Quote } from 'lucide-react';

interface FeedbackCardProps {
  strengths: string[];
  improvements: string[];
  evaluatorNote: string;
}

export function FeedbackCard({ strengths, improvements, evaluatorNote }: FeedbackCardProps) {
  return (
    <div className="space-y-5">
      <Card padding="lg">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[var(--radius-md)] bg-[var(--color-success-soft)] text-[var(--color-success)] flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h3 className="text-[17px] font-semibold text-[var(--color-ink-primary)]">Yang sudah kuat</h3>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5">
          {strengths.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="lg">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] text-[var(--color-warning)] flex items-center justify-center">
            <ArrowUpCircle className="h-5 w-5" />
          </div>
          <h3 className="text-[17px] font-semibold text-[var(--color-ink-primary)]">Yang bisa ditingkatkan</h3>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5">
          {improvements.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--color-warning)] shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="lg" className="bg-[var(--color-surface-soft)]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[var(--radius-md)] bg-white text-[var(--color-brand-600)] flex items-center justify-center">
            <Quote className="h-5 w-5" />
          </div>
          <h3 className="text-[17px] font-semibold text-[var(--color-ink-primary)]">Evaluator Feedback</h3>
        </div>
        <p className="mt-4 text-[14.5px] leading-relaxed text-[var(--color-ink-secondary)]">
          {evaluatorNote}
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-[var(--color-brand-500)] text-white text-[11px] font-bold flex items-center justify-center">
            SK
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-[var(--color-ink-primary)]">Sekolah Karir Evaluator</p>
            <p className="text-[11px] text-[var(--color-ink-tertiary)]">Marketing Division</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
