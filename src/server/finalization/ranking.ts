/**
 * Weekly ranking math (PRD §33, §34). Pure module — safe for offline tests.
 *
 * Global cross-division leaderboard. Ordering is fully deterministic:
 *   1. final_score DESC
 *   2. final_submitted_at ASC (earlier submit wins ties)
 *   3. user_id ASC (final deterministic tiebreak when timestamps collide)
 *
 * Points (never expire; ledger is the source of truth, this is the formula):
 *   points = round(final score 0–100) + rank bonus
 *   rank bonus: rank 1 → +200, rank 2 → +100, rank 3 → +50, rank 4+ → +0.
 *
 * The score itself is what a participant earns, so better work earns more at
 * every rank — under the old flat ladder (300/200/150/100) a 95 and a 55 at
 * rank 4+ both earned 100. The bonus keeps the podium worth chasing, and the
 * totals stay close to the old ladder for typical scores (a 90 at rank 1 is
 * 290, a 75 at rank 5 is 75).
 * No valid completion → 0 points and no leaderboard row at all.
 */

export interface Finalist {
  userId: string;
  finalScore: number;
  finalSubmittedAt: Date;
}

export interface RankedFinalist extends Finalist {
  rank: number;
  points: number;
}

export function rankBonus(rank: number): number {
  if (rank === 1) return 200;
  if (rank === 2) return 100;
  if (rank === 3) return 50;
  return 0;
}

/** The score's own points: clamped to 0–100 and rounded half up. */
export function scorePoints(finalScore: number): number {
  if (!Number.isFinite(finalScore)) return 0;
  return Math.round(Math.min(100, Math.max(0, finalScore)));
}

export function pointsForResult(rank: number, finalScore: number): number {
  return scorePoints(finalScore) + rankBonus(rank);
}

export function rankFinalists<T extends Finalist>(finalists: T[]): Array<T & { rank: number; points: number }> {
  const sorted = [...finalists].sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const timeDiff = a.finalSubmittedAt.getTime() - b.finalSubmittedAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });
  return sorted.map((finalist, index) => {
    const rank = index + 1;
    return { ...finalist, rank, points: pointsForResult(rank, finalist.finalScore) };
  });
}
