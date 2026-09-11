/**
 * How one skill-evidence row may be worded on a card.
 *
 * Only CRITERION evidence is a skill score: a rubric criterion attributed to
 * the skill measured it. Any other attribution means the project's overall
 * score is standing in for a skill nothing measured, so it is shown as the
 * project's score with the context spelled out — the same rule Career Report
 * applies, so the two surfaces never disagree about "Excel 82".
 */
export interface SkillEvidencePresentation {
  measured: boolean;
  scoreText: string;
  scoreLabel: string;
  badge: string | null;
  note: string | null;
}

export function presentSkillEvidence(item: { score: number; attribution: string }): SkillEvidencePresentation {
  if (item.attribution === 'CRITERION') {
    return { measured: true, scoreText: `${item.score}/100`, scoreLabel: 'Skor skill terukur', badge: null, note: null };
  }
  return {
    measured: false,
    scoreText: `Skor project: ${item.score}/100`,
    scoreLabel: 'Konteks pengerjaan',
    badge: 'Belum diuji khusus',
    note: 'Skill ini dipakai dalam project, tetapi belum dinilai lewat kriteria rubrik khusus. Angkanya skor project, bukan skor skill.',
  };
}
