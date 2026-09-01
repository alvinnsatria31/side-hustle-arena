'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, FolderOpen } from 'lucide-react';
import { Button, ButtonLink } from './Button';
import { cn } from '@/lib/cn';

type StateTone = 'empty' | 'error' | 'success';

interface StateBoxProps {
  tone: StateTone;
  title: string;
  description: ReactNode;
  icon?: ReactNode;
  primaryAction?: { label: string; onClick?: () => void; href?: string };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}

const ICONS: Record<StateTone, ReactNode> = {
  empty: <FolderOpen size={26} strokeWidth={1.6} aria-hidden />,
  error: <AlertTriangle size={26} strokeWidth={1.8} aria-hidden />,
  success: <Check size={28} strokeWidth={2.4} aria-hidden />,
};

/** Empty / error / success box (approved state style: icon tile + copy + recovery CTA). */
export function StateBox({ tone, title, description, icon, primaryAction, secondaryAction, className }: StateBoxProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'mx-auto w-full max-w-[420px] rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-8 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto mb-[18px] flex h-16 w-16 items-center justify-center rounded-[var(--radius-sk-xl)]',
          tone === 'empty' && 'bg-sk-blue-tint text-sk-blue',
          tone === 'error' && 'bg-sk-error-tint text-sk-error',
          tone === 'success' && 'bg-sk-success-tint text-sk-success',
        )}
      >
        {icon ?? ICONS[tone]}
      </div>
      <h4 className="mb-1.5 text-[19px] font-bold tracking-[-0.01em] text-sk-navy">{title}</h4>
      <p className="mb-5 text-[13px] leading-relaxed text-sk-muted">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {primaryAction &&
            (primaryAction.href ? (
              <ButtonLink href={primaryAction.href} onClick={primaryAction.onClick}>
                {primaryAction.label}
              </ButtonLink>
            ) : (
              <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
            ))}
          {secondaryAction &&
            (secondaryAction.href ? (
              <ButtonLink variant="ghost" href={secondaryAction.href} onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </ButtonLink>
            ) : (
              <Button variant="ghost" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      )}
    </motion.div>
  );
}
