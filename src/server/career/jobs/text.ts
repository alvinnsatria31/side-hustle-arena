/**
 * Skill-name normalization, kept apart from everything that touches Node.
 *
 * `matching-core` and the Career Report run in the browser as well as on the
 * server, and importing them used to drag in `normalize.ts` — which imports
 * `node:crypto` for hashing, a module a client bundle cannot resolve. Splitting
 * the one pure string function out is what lets both sides share exactly the
 * same rule instead of growing a second, subtly different one.
 */
export function normalizeText(value: string): string {
  return (value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
