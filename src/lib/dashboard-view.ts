import type { ParticipantEnrollment } from '@/lib/participant-client';

const STEPS: Record<string, { label: string; progress: number }> = {
  BRIEF: { label: 'Memahami brief', progress: 20 },
  PLAN: { label: 'Menyusun rencana', progress: 40 },
  WORK: { label: 'Pengerjaan', progress: 60 },
  REVIEW: { label: 'Pemeriksaan', progress: 80 },
  SUBMIT: { label: 'Siap dikirim', progress: 100 },
};

export function dashboardFocus(enrollment: ParticipantEnrollment) {
  const slug = encodeURIComponent(enrollment.project.slug);
  if (enrollment.status === 'VOIDED' || enrollment.submission?.status === 'VOIDED') {
    return { label: 'Jelajahi proyek', href: '/app/arena/projects', progress: 0, stage: 'Dibatalkan' };
  }
  if (enrollment.ranking) {
    return { label: 'Lihat hasil', href: `/app/arena/result/${slug}`, progress: 100, stage: 'Hasil tersedia' };
  }
  if (enrollment.submission?.latestVersionId) {
    return { label: 'Lihat kiriman', href: `/app/arena/submission/${slug}`, progress: 100, stage: 'Menunggu hasil' };
  }
  const step = STEPS[enrollment.workspace?.currentStep ?? 'BRIEF'] ?? STEPS.BRIEF;
  return { label: 'Lanjutkan proyek', href: `/app/arena/workspace/${slug}`, progress: step.progress, stage: step.label };
}
