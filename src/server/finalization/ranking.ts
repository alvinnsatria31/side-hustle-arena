/**
 * Weekly ranking math (PRD §33, §34). Pure module — safe for offline tests.
 *
 * Global cross-division leaderboard. Ordering is fully deterministic:
 *   1. final_score DESC
 *   2. final_submitted_at ASC (earlier submit wins ties)
 *   3. user_id ASC (final deterministic tiebreak when timestamps collide)
 *
 * Points (never expire; ledger is the source of truth, this is the formula):
 *   rank 1 → 300, rank 2 → 200, rank 3 → 150, rank 4+ → 100.
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

export function pointsForRank(rank: number): number {
  if (rank === 1) return 300;
  if (rank === 2) return 200;
  if (rank === 3) return 150;
  return 100;
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
    return { ...finalist, rank, points: pointsForRank(rank) };
  });
}
