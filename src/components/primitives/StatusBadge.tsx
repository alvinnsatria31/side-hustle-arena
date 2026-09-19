import { Badge } from './Badge';
import type { ProjectStatus, WorkspaceStep } from '@/types/project';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: 'blue' | 'mint' | 'amber' | 'slate' | 'recommended' }> = {
  none: { label: 'BELUM ADA PROYEK', variant: 'slate' },
  active: { label: 'SEDANG DIKERJAKAN', variant: 'blue' },
  submitted: { label: 'MENUNGGU PENILAIAN', variant: 'amber' },
  under_review: { label: 'SEDANG DINILAI', variant: 'amber' },
  review_ready: { label: 'HASIL SIAP', variant: 'recommended' },
  completed: { label: 'SELESAI', variant: 'mint' },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export const WORKSPACE_STEP_LABELS: Record<WorkspaceStep, string> = {
  brief: 'Brief',
  plan: 'Rencana',
  work: 'Kerjakan',
  review: 'Periksa',
  submit: 'Kirim hasil',
};
