'use client';

import { StateBox } from '@/components/primitives/StateBox';

interface ErrorStateProps {
  title: string;
  description: React.ReactNode;
  icon?: React.ReactNode;
  primaryAction?: { label: string; onClick?: () => void; href?: string };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}

/** Calm, actionable error state. */
export function ErrorState(props: ErrorStateProps) {
  return <StateBox tone="error" {...props} />;
}
