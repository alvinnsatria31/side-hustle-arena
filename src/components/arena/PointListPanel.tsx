import { Check, TriangleAlert } from 'lucide-react';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { cn } from '@/lib/cn';

/** "Yang sudah kuat" / "Yang perlu diperkuat" panel list. */
export function PointListPanel({
  tone,
  title,
  points,
  className,
}: {
  tone: 'strength' | 'improve';
  title: string;
  points: string[];
  className?: string;
}) {
  const strong = tone === 'strength';
  return (
    <Card className={cn('p-6', className)}>
      <PanelHeading pin={strong ? 'g' : 'a'}>{title}</PanelHeading>
      <ul className="flex flex-col gap-3">
        {points.map((point, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-sk-text">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-[11px]',
                strong ? 'bg-sk-success-tint text-sk-success' : 'bg-sk-warning-wash text-sk-warning-ink',
              )}
            >
              {strong ? <Check size={12} strokeWidth={3} /> : <TriangleAlert size={11} strokeWidth={2.4} />}
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
