import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * An empty section that still offers a move.
 *
 * The dashboard used to answer "you have no projects yet" with one grey
 * sentence in a dashed box — true, and a dead end. Every empty state here
 * names the thing that is missing and points at the one place it comes from.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-4 rounded-[var(--radius-sk-2xl)] border border-dashed border-sk-blue-tint-border bg-sk-blue-wash p-6 sm:flex-row sm:items-center sm:gap-5 sm:p-7',
        className,
      )}
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-sk-md)] bg-white text-sk-blue shadow-sk-xs"
      >
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-bold text-sk-navy">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-sk-muted">{body}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-sk-md)] bg-white px-4 text-[13px] font-bold text-sk-blue shadow-sk-xs transition-colors hover:bg-sk-blue hover:text-white"
        >
          {action.label}
          <ArrowRight size={15} aria-hidden />
        </Link>
      )}
    </div>
  );
}
