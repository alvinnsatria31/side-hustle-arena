/**
 * Which submitted version becomes a participant's result?
 *
 * PRD §33/§62 says the latest *valid reviewed* version — and the two words in
 * the middle carry the weight. Picking the newest version that merely consumed
 * a review attempt is wrong: if a third attempt was accepted and then its
 * review failed terminally (provider outage, extraction crash), that version
 * has an attempt number and no score, and the participant would be dropped
 * from the week entirely despite holding a perfectly good result from attempt
 * two. Infrastructure failure must not cost someone their completion.
 *
 * So: walk versions newest-first and take the first one that is actually
 * finalizable. Kept free of the database so the rule can be tested directly.
 */

export interface CandidateVersion {
  id: string;
  versionNumber: number;
  reviewAttemptNumber: number | null;
  accessStatus: string;
  submittedAt: Date;
}

export interface CandidateReview {
  id: string;
  status: string;
  finalScore: string | number | null;
}

/** Reviews that represent a real, usable score. */
export function isFinalizableReview(review: CandidateReview | null | undefined): review is CandidateReview {
  if (!review) return false;
  if (review.status !== "COMPLETED_HIDDEN" && review.status !== "PUBLISHED") return false;
  // `Number(null)` is 0, so a null score would otherwise read as a legitimate
  // zero and rank someone on a review that never produced one.
  if (review.finalScore == null || review.finalScore === "") return false;
  return Number.isFinite(Number(review.finalScore));
}

/**
 * Versions that are allowed to be someone's final answer, newest first.
 *
 * A version whose artifacts a reviewer could not open (`FAILED`) never
 * consumed an attempt and never gets a score, so it is not a candidate — it is
 * a record of a rejected submit.
 */
export function eligibleVersionOrder<T extends CandidateVersion>(versions: T[]): T[] {
  return versions
    .filter((version) => version.reviewAttemptNumber != null && version.accessStatus === "ACCESSIBLE")
    .sort((left, right) => right.versionNumber - left.versionNumber);
}

/**
 * The newest version that has a usable review, or null if none has one.
 *
 * `latestReviewFor` returns the highest-run review for a version; a version
 * whose newest run failed falls through to the older version rather than
 * removing the participant from the week.
 */
export function selectFinalVersion<T extends CandidateVersion>(
  versions: T[],
  latestReviewFor: (versionId: string) => CandidateReview | null | undefined,
): { version: T; review: CandidateReview } | null {
  for (const version of eligibleVersionOrder(versions)) {
    const review = latestReviewFor(version.id);
    if (isFinalizableReview(review)) return { version, review };
  }
  return null;
}
