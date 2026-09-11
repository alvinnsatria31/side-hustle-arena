/**
 * One statement of "is this submission complete?", shared by both sides.
 *
 * The rule lived only in the server's `validateRequirements`, and the form was
 * built to a different, simpler model: one link box and one file box, bound to
 * the first requirement of each type. A project asking for two links therefore
 * had one input, both links landed on the same requirement, and the submit was
 * refused with SUBMISSION_REQUIREMENTS_INCOMPLETE naming a requirement the
 * participant had never seen a box for.
 *
 * Keeping the rule here means the form can tell someone which deliverable is
 * short before they submit, in the same terms the server will use if they do.
 * Pure — no database, no React, safe for offline tests.
 */

export interface RequirementShape {
  id: string;
  label: string;
  type: "FILE" | "LINK" | "TEXT";
  required: boolean;
  minItems: number;
  maxItems: number;
}

export interface AttachedItem {
  requirementId: string | null;
}

/** The lowest number of items this requirement accepts. */
export function minimumFor(requirement: Pick<RequirementShape, "required" | "minItems">): number {
  // `required` beats a minItems of 0: a deliverable marked required with no
  // explicit minimum still needs one item, which is what the server enforces.
  return requirement.required ? Math.max(1, requirement.minItems) : requirement.minItems;
}

/**
 * How many items this requirement may hold, honouring the global per-submission
 * cap as well as the requirement's own maxItems. Both apply; the smaller wins.
 */
export function capacityFor(requirement: Pick<RequirementShape, "maxItems">, globalCap: number): number {
  return Math.min(globalCap, requirement.maxItems);
}

export function countForRequirement(requirementId: string, items: readonly AttachedItem[]): number {
  return items.filter((item) => item.requirementId === requirementId).length;
}

/** Requirements that do not yet have enough items. Empty means submittable. */
export function unmetRequirements<T extends RequirementShape>(requirements: readonly T[], items: readonly AttachedItem[]): T[] {
  return requirements.filter((requirement) => countForRequirement(requirement.id, items) < minimumFor(requirement));
}

/** Requirements holding more items than they accept. */
export function overfilledRequirements<T extends RequirementShape>(requirements: readonly T[], items: readonly AttachedItem[]): T[] {
  return requirements.filter((requirement) => countForRequirement(requirement.id, items) > requirement.maxItems);
}
