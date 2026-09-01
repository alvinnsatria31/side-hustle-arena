import { Badge } from './Badge';
import type { ProjectStatus, WorkspaceStep } from '@/types/project';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: 'blue' | 'mint' | 'amber' | 'slate' | 'recommended' }> = {
  none: { label: 'BELUM ADA PROJECT', variant: 'slate' },
  active: { label: 'IN PROGRESS', variant: 'blue' },
  submitted: { label: 'MENUNGGU REVIEW', variant: 'amber' },
  under_review: { label: 'SEDANG DIREVIEW', variant: 'amber' },
  review_ready: { label: 'FEEDBACK SIAP', variant: 'recommended' },
  completed: { label: 'COMPLETED', variant: 'mint' },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export const WORKSPACE_STEP_LABELS: Record<WorkspaceStep, string> = {
  brief: 'Brief',
  plan: 'Plan Your Work',
  work: 'Do The Work',
  review: 'Review Checklist',
  submit: 'Submit',
};
