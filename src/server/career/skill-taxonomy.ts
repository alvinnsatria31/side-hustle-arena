import { normalizeText } from "./jobs/text";

/**
 * One vocabulary for skills, shared by Arena, Career Report, CV and Jobs.
 *
 * Before this, each surface compared skill names with its own string rule.
 * Career Report matched a CV's "Ms. Excel" against Arena's "Excel" by lowercasing
 * and collapsing spaces, which failed on the punctuation; Jobs compared raw
 * text and scored a provider's "MS Excel" as a miss. Both produced confident,
 * wrong answers — a participant told they had no evidence for a skill they had
 * demonstrated.
 *
 * The index is built from the skills table plus the curated `skill_aliases`
 * rows, so an operator can teach the system a spelling without a deploy. A name
 * that resolves to nothing stays unresolved and is reported as such: inventing
 * a taxonomy entry to make a match would be the same failure in the other
 * direction.
 */

export interface SkillRecord {
  id: string;
  name: string;
  slug: string;
}

export interface SkillAliasRecord {
  skillId: string;
  alias: string;
}

export interface SkillIndex {
  /** Resolve a free-text skill name to a skill id, or null. */
  resolve(name: string): string | null;
  /** The canonical display name for a skill id. */
  nameOf(skillId: string): string | null;
  size: number;
}

/**
 * Aliases are stored already normalized (that is what makes the unique index
 * meaningful), so a raw alias row is normalized again here rather than trusted:
 * a hand-inserted row with different spacing must still be found.
 */
export function buildSkillIndex(skills: SkillRecord[], aliases: SkillAliasRecord[] = []): SkillIndex {
  const byKey = new Map<string, string>();
  const names = new Map<string, string>();
  for (const skill of skills) {
    names.set(skill.id, skill.name);
    for (const key of [normalizeText(skill.name), normalizeText(skill.slug)]) {
      if (key) byKey.set(key, skill.id);
    }
  }
  // Curated aliases win: they are the deliberate answer, added precisely
  // because the derived keys got it wrong.
  for (const alias of aliases) {
    const key = normalizeText(alias.alias);
    if (key) byKey.set(key, alias.skillId);
  }
  return {
    resolve: (name) => byKey.get(normalizeText(name ?? "")) ?? null,
    nameOf: (skillId) => names.get(skillId) ?? null,
    size: byKey.size,
  };
}

/**
 * Aliases every taxonomy gets for free, derived from the canonical name.
 *
 * Deliberately mechanical — an abbreviation, a punctuation variant, a common
 * vendor prefix — because a guessed synonym ("data viz" → "Business
 * Intelligence") is exactly the kind of confident wrongness this module exists
 * to prevent. Anything semantic belongs in a curated `skill_aliases` row where
 * a person's name is on it.
 */
export function derivedAliases(name: string): string[] {
  const canonical = normalizeText(name);
  if (!canonical) return [];
  const out = new Set<string>([canonical]);
  // "Microsoft Excel" / "MS Excel" → "excel"
  const withoutVendor = canonical.replace(/^(microsoft|ms|adobe|google|apache) /, "");
  if (withoutVendor) out.add(withoutVendor);
  // "Excel" → "ms excel", the spelling boards use most often.
  if (!canonical.startsWith("ms ") && !canonical.startsWith("microsoft ")) out.add(`ms ${canonical}`);
  out.delete("");
  return [...out];
}
