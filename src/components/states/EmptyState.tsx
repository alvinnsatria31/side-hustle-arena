'use client';

import { StateBox } from '@/components/primitives/StateBox';

interface EmptyStateProps {
  title: string;
  description: React.ReactNode;
  icon?: React.ReactNode;
  primaryAction?: { label: string; onClick?: () => void; href?: string };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}

/** Empty state with a useful next action. */
export function EmptyState(props: EmptyStateProps) {
  return <StateBox tone="empty" {...props} />;
}
