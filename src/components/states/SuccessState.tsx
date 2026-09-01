'use client';

import { StateBox } from '@/components/primitives/StateBox';

interface SuccessStateProps {
  title: string;
  description: React.ReactNode;
  icon?: React.ReactNode;
  primaryAction?: { label: string; onClick?: () => void; href?: string };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}

/** Success confirmation state. */
export function SuccessState(props: SuccessStateProps) {
  return <StateBox tone="success" {...props} />;
}
