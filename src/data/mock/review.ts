import type { ArenaProject, ReviewResult } from '@/types/project';

const RUBRIC_PRESETS: number[][] = [
  [22, 22, 23, 21], // 88 — used by the featured project (design reference)
  [21, 22, 22, 21], // 86
  [20, 22, 22, 21], // 85
  [21, 21, 22, 21], // 85
];

function presetIndex(slug: string): number {
  let sum = 0;
  for (let i = 0; i < slug.length; i += 1) sum += slug.charCodeAt(i);
  return sum % RUBRIC_PRESETS.length;
}

const STATUS_BY_SCORE = (score: number): string => {
  if (score >= 86) return 'EXCELLENT';
  if (score >= 78) return 'STRONG WORK';
  return 'GOOD PROGRESS';
};

const SUMMARY_BY_SCORE = (score: number, project: ArenaProject): string =>
  score >= 86
    ? `${project.shortDescription.replace(/\.$/, '')} — hasil kamu jelas, terstruktur, dan insight-nya langsung actionable. Ada beberapa area kecil untuk di-polish di project berikutnya.`
    : `Kamu menuntaskan objective utama dengan rapi. Masih ada ruang untuk memperdalam analisis dan memperjelas alur penyampaian di project berikutnya.`;

/** Deterministic demo review for a finished project. */
export function buildReviewResult(project: ArenaProject, submittedAt: Date): ReviewResult {
  const scores = RUBRIC_PRESETS[presetIndex(project.slug)];
  const rubric = project.rubric.map((criterion, i) => ({
    label: criterion.label,
    score: scores[i % scores.length],
    max: 25,
  }));
  const score = rubric.reduce((total, item) => total + item.score, 0);

  return {
    score,
    statusLabel: STATUS_BY_SCORE(score),
    summary: SUMMARY_BY_SCORE(score, project),
    rubric,
    strengths: [
      'Objective utama terpenuhi dan mudah dipahami reviewer.',
      'Deliverables lengkap dan tersusun dengan logika yang jelas.',
      'Kualitas output profesional untuk level junior.',
    ],
    improvements: [
      'Tambahkan konteks perbandingan (sebelum/sesudah atau periode) untuk memperkuat insight.',
      'Perjelas alur baca pada bagian deliverable utama.',
      'Kuantifikasikan dampak setiap rekomendasi yang kamu berikan.',
    ],
    skillsProven: project.skills.slice(0, 3),
    pointsEarned: project.points,
    reviewedAt: new Date(submittedAt.getTime() + 1000 * 60 * 60 * 4).toISOString(),
  };
}
