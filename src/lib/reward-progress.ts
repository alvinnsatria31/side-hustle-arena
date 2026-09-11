/**
 * Where a participant stands on the reward ladder, in the terms the profile and
 * the Arena page use: points collected, the gap to the next reward, and the gap
 * to the main reward. Pure, so the numbers behind that wording are unit-tested.
 *
 * Progress counts lifetime points — the quantity that unlocks a milestone —
 * not the spendable balance. Claiming a reward spends balance, but it must
 * never move anyone backwards on the ladder.
 */

export interface LadderStepLike {
  slug: string;
  title: string;
  pointsRequired: number;
}

export interface RewardTarget extends LadderStepLike {
  /** Points still missing; 0 once reached. */
  remaining: number;
  /** 0–100, rounded down so "100%" is never shown before the target is met. */
  percent: number;
}

export interface RewardProgressSummary {
  points: number;
  /** The cheapest reward not yet reached, or null when every one is. */
  next: RewardTarget | null;
  /** The most expensive reward: the ladder's main prize. */
  main: RewardTarget | null;
  mainReached: boolean;
  reachedCount: number;
  total: number;
}

function target(step: LadderStepLike, points: number): RewardTarget {
  const remaining = Math.max(0, step.pointsRequired - points);
  const percent = step.pointsRequired > 0 ? Math.min(100, Math.floor((points / step.pointsRequired) * 100)) : 100;
  return { slug: step.slug, title: step.title, pointsRequired: step.pointsRequired, remaining, percent };
}

export function rewardProgress(points: number, steps: LadderStepLike[]): RewardProgressSummary {
  const safe = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const sorted = [...steps].sort((a, b) => a.pointsRequired - b.pointsRequired || a.slug.localeCompare(b.slug));
  const nextStep = sorted.find((step) => step.pointsRequired > safe) ?? null;
  const mainStep = sorted.at(-1) ?? null;
  return {
    points: safe,
    next: nextStep ? target(nextStep, safe) : null,
    main: mainStep ? target(mainStep, safe) : null,
    mainReached: mainStep ? safe >= mainStep.pointsRequired : false,
    reachedCount: sorted.filter((step) => step.pointsRequired <= safe).length,
    total: sorted.length,
  };
}

export function formatPoints(value: number): string {
  return value.toLocaleString('id-ID');
}
