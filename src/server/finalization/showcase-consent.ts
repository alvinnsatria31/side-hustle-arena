/**
 * Who may appear in the public Showcase.
 *
 * The Showcase used to publish the name, avatar, project and score of every
 * top-ranked participant, to every visitor, with nothing recording that they
 * had agreed to it. Ranking well is not consent to be featured.
 *
 * So: private by default, published only on a positive, timestamped act, and
 * revocable — revoking removes the entry from the next render rather than
 * leaving it up until someone remembers. Nothing here infers consent from
 * behaviour, because an inference is exactly what a participant cannot audit.
 *
 * The leaderboard is a different surface with a different basis: PRD §103
 * makes score, leaderboard and points public after finalization. This module
 * governs the Showcase only, and the distinction is deliberate — see
 * docs/backend/SHOWCASE_CONSENT.md.
 */

export interface ConsentSubject {
  showcaseConsentAt: Date | null;
  /** A suspended or deleted account is never featured, consent or not. */
  status?: string | null;
  anonymizedAt?: Date | null;
}

export function hasShowcaseConsent(subject: ConsentSubject): boolean {
  if (!subject.showcaseConsentAt) return false;
  if (subject.anonymizedAt) return false;
  if (subject.status && subject.status !== "ACTIVE") return false;
  return true;
}

export type ConsentDecision = { publish: true } | { publish: false; reason: "NO_CONSENT" | "NOT_ACTIVE" | "ANONYMIZED" };

/** Why an otherwise-eligible finalist is not on the Showcase. */
export function showcaseDecision(subject: ConsentSubject): ConsentDecision {
  if (subject.anonymizedAt) return { publish: false, reason: "ANONYMIZED" };
  if (subject.status && subject.status !== "ACTIVE") return { publish: false, reason: "NOT_ACTIVE" };
  if (!subject.showcaseConsentAt) return { publish: false, reason: "NO_CONSENT" };
  return { publish: true };
}
