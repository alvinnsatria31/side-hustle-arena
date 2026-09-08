import { normalizeText } from "./text";

/**
 * Skill coverage, computed only where there is something to compute it from.
 *
 * The rule this module exists to enforce: a number on a card is a claim, and a
 * claim needs evidence on both sides. If a feed gave no skills for a role, or
 * the participant has no finalized evidence, the honest answer is "we cannot
 * say" — `null` — not `0%`, which reads as "you match nothing".
 *
 * Matching compares taxonomy IDs, not strings. A provider's "MS Excel" and
 * Arena's "Excel" are one skill; comparing raw text scored that as a miss and
 * produced a confident, wrong number.
 */

export interface JobSkillRef {
  skillId: string;
  name: string;
  kind: "REQUIRED" | "PREFERRED";
}

export interface MatchableJob {
  id: string;
  /** Taxonomy-resolved skills. */
  skills: JobSkillRef[];
  /** Provider skill text that resolved to nothing in the taxonomy. */
  unresolvedSkills: string[];
}

export interface CoverageResult {
  /** Percentage of REQUIRED taxonomy skills with finalized evidence, or null. */
  matchScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  /** Why a score could not be produced — shown instead of a fake number. */
  unscoredReason: "NO_EVIDENCE" | "NO_SKILL_DATA" | null;
  /**
   * How much of the role's stated skill list we could actually map. A score
   * derived from two of nine listed skills deserves to be labelled as such.
   */
  taxonomyCoverage: { resolved: number; total: number };
}

export function computeCoverage(job: MatchableJob, evidenceSkillIds: ReadonlySet<string>): CoverageResult {
  const required = job.skills.filter((skill) => skill.kind === "REQUIRED");
  const considered = required.length ? required : job.skills;
  const resolved = considered.length;
  const total = resolved + job.unresolvedSkills.length;

  if (!resolved) {
    return {
      matchScore: null, matchedSkills: [], missingSkills: [],
      unscoredReason: "NO_SKILL_DATA", taxonomyCoverage: { resolved, total },
    };
  }
  if (!evidenceSkillIds.size) {
    return {
      matchScore: null, matchedSkills: [], missingSkills: considered.map((skill) => skill.name),
      unscoredReason: "NO_EVIDENCE", taxonomyCoverage: { resolved, total },
    };
  }
  const matched = considered.filter((skill) => evidenceSkillIds.has(skill.skillId));
  return {
    matchScore: Math.round((matched.length / considered.length) * 100),
    matchedSkills: matched.map((skill) => skill.name),
    missingSkills: considered.filter((skill) => !evidenceSkillIds.has(skill.skillId)).map((skill) => skill.name),
    unscoredReason: null,
    taxonomyCoverage: { resolved, total },
  };
}

export interface JobsFilters {
  search?: string;
  employmentType?: string;
  workMode?: string;
  location?: string;
  sourceSlug?: string;
}

export function filterOpenings<T extends {
  title: string; company: string; location: string | null;
  employmentType: string; workMode: string; sourceSlug: string;
  skills: JobSkillRef[]; unresolvedSkills: string[];
}>(jobs: T[], filters: JobsFilters): T[] {
  const search = normalizeText(filters.search ?? "");
  return jobs.filter((job) =>
    (!filters.employmentType || job.employmentType === filters.employmentType) &&
    (!filters.workMode || job.workMode === filters.workMode) &&
    (!filters.location || job.location === filters.location) &&
    (!filters.sourceSlug || job.sourceSlug === filters.sourceSlug) &&
    (!search || normalizeText([
      job.title, job.company, job.location ?? "",
      ...job.skills.map((skill) => skill.name), ...job.unresolvedSkills,
    ].join(" ")).includes(search)));
}

/** Best coverage first; ties broken by id so the order never wobbles. */
export function rankByCoverage<T extends { id: string; matchScore: number | null }>(jobs: T[]): T[] {
  return [...jobs].sort((left, right) => (right.matchScore ?? -1) - (left.matchScore ?? -1) || left.id.localeCompare(right.id));
}

export function safeJobsPortalUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
