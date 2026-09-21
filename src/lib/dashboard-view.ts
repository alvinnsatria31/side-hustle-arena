import type { ParticipantEnrollment, ParticipantOverview } from '@/lib/participant-client';

const STEPS: Record<string, { label: string; progress: number }> = {
  BRIEF: { label: 'Memahami brief', progress: 20 },
  PLAN: { label: 'Menyusun rencana', progress: 40 },
  WORK: { label: 'Pengerjaan', progress: 60 },
  REVIEW: { label: 'Pemeriksaan', progress: 80 },
  SUBMIT: { label: 'Siap dikirim', progress: 100 },
};

/** The five workspace steps in order — the dashboard stepper renders this list. */
export const STEP_ORDER = ['BRIEF', 'PLAN', 'WORK', 'REVIEW', 'SUBMIT'] as const;

/** Short labels for the stepper; the long ones live in `STEPS` above. */
export const STEP_SHORT: Record<(typeof STEP_ORDER)[number], string> = {
  BRIEF: 'Brief',
  PLAN: 'Rencana',
  WORK: 'Kerjakan',
  REVIEW: 'Periksa',
  SUBMIT: 'Kirim',
};

export function dashboardFocus(enrollment: ParticipantEnrollment) {
  const slug = encodeURIComponent(enrollment.project.slug);
  if (enrollment.status === 'VOIDED' || enrollment.submission?.status === 'VOIDED') {
    return {
      label: 'Jelajahi proyek',
      href: '/app/arena/projects',
      progress: 0,
      stage: 'Dibatalkan',
      step: null,
    };
  }
  if (enrollment.ranking) {
    return {
      label: 'Lihat hasil',
      href: `/app/arena/result/${slug}`,
      progress: 100,
      stage: 'Hasil tersedia',
      step: null,
    };
  }
  if (enrollment.submission?.latestVersionId) {
    return {
      label: 'Lihat kiriman',
      href: `/app/arena/submission/${slug}`,
      progress: 100,
      stage: 'Menunggu hasil',
      step: null,
    };
  }
  const key = (enrollment.workspace?.currentStep ?? 'BRIEF') as (typeof STEP_ORDER)[number];
  const step = STEPS[key] ?? STEPS.BRIEF;
  return {
    label: 'Lanjutkan proyek',
    href: `/app/arena/workspace/${slug}`,
    progress: step.progress,
    stage: step.label,
    step: STEP_ORDER.includes(key) ? key : 'BRIEF',
  };
}

export type DeadlineTone = 'over' | 'critical' | 'urgent' | 'calm';

/**
 * Remaining time on a sprint, in the unit that actually helps.
 *
 * `formatCountdown` counts hours, which is right inside a workspace on the last
 * day and useless on the dashboard: a week-long sprint reads "148j 12m 03d"
 * there, a number nobody converts back into "Thursday". Days lead until the
 * last day, and the tone lets the surface shout only when shouting is earned.
 */
export function sprintRemaining(
  deadlineAt: string,
  now = Date.now(),
): { text: string; tone: DeadlineTone } {
  const left = new Date(deadlineAt).getTime() - now;
  if (!Number.isFinite(left) || left <= 0) return { text: 'Waktu habis', tone: 'over' };
  const minutes = Math.floor(left / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 60) return { text: `${minutes} menit lagi`, tone: 'critical' };
  if (hours < 24)
    return {
      text: `${hours} jam ${minutes % 60} menit lagi`,
      tone: 'critical',
    };
  if (days < 3) return { text: `${days} hari ${hours % 24} jam lagi`, tone: 'urgent' };
  return { text: `${days} hari lagi`, tone: 'calm' };
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  tone: DeadlineTone;
  over: boolean;
}

/**
 * The same countdown as `sprintRemaining`, broken into the three blocks the
 * deadline card renders (dd / hh / mm) instead of one formatted sentence.
 */
export function sprintRemainingParts(deadlineAt: string, now = Date.now()): CountdownParts {
  const left = new Date(deadlineAt).getTime() - now;
  if (!Number.isFinite(left) || left <= 0) {
    return { days: 0, hours: 0, minutes: 0, tone: 'over', over: true };
  }
  const totalMinutes = Math.floor(left / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const tone: DeadlineTone = totalMinutes < 60 || totalHours < 24 ? 'critical' : days < 3 ? 'urgent' : 'calm';
  return { days, hours: totalHours % 24, minutes: totalMinutes % 60, tone, over: false };
}

export type EnrollmentTone = 'result' | 'waiting' | 'active' | 'sealed' | 'voided';

/** One reading of "where is this enrollment", shared by every card that shows one. */
export function enrollmentStatus(enrollment: ParticipantEnrollment): {
  label: string;
  tone: EnrollmentTone;
} {
  const voided = enrollment.status === 'VOIDED' || enrollment.submission?.status === 'VOIDED';
  if (voided) return { label: 'Dibatalkan', tone: 'voided' };
  if (enrollment.ranking) return { label: 'Hasil tersedia', tone: 'result' };
  if (!enrollment.sealed) return { label: 'Tidak masuk peringkat', tone: 'sealed' };
  if (enrollment.submission?.latestVersionId)
    return { label: 'Menunggu hasil akhir', tone: 'waiting' };
  return { label: 'Sedang dikerjakan', tone: 'active' };
}

/**
 * The best rank this participant has ever placed, and the score that earned it.
 *
 * Four tiles read better than three, and this is the one number the leaderboard
 * page already knows that the dashboard was throwing away.
 */
export function bestRanking(history: ParticipantOverview['history']) {
  const ranked = history.filter((row) => row.ranking && row.status !== 'VOIDED');
  if (!ranked.length) return null;
  return ranked.reduce(
    (best, row) => (row.ranking!.rank < best.ranking!.rank ? row : best),
    ranked[0],
  );
}

/**
 * My placing for one week, read from overview history.
 *
 * Leaderboard rows carry no user key, so the preview never guesses which row
 * is mine — the "Kamu" strip comes from here instead.
 */
export function myWeekRanking(
  history: Array<{
    week: { weekCode: string };
    ranking: { rank: number; finalScore: number } | null | undefined;
  }>,
  weekCode: string,
): { rank: number; finalScore: number } | null {
  const row = history.find((entry) => entry.week.weekCode === weekCode);
  if (!row?.ranking) return null;
  return { rank: row.ranking.rank, finalScore: row.ranking.finalScore };
}
