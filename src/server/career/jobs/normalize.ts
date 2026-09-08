import { createHash } from "node:crypto";
import { readPath, type FieldMap } from "./contract";
import { normalizeText } from "./text";

/**
 * Turn one provider record into a row we are willing to show a participant,
 * or explain why we will not.
 *
 * Everything here is pure and total: it never throws, never fetches, and never
 * guesses. A field the provider did not supply comes back as null or
 * UNSPECIFIED — not as a plausible default — because a fabricated "Full-time"
 * or "Remote" reads exactly like a real one on the card, and the participant
 * has no way to tell.
 */

export type WorkMode = "REMOTE" | "HYBRID" | "ONSITE" | "UNSPECIFIED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "FREELANCE" | "TEMPORARY" | "UNSPECIFIED";

export interface NormalizedOpening {
  externalId: string;
  canonicalKey: string;
  title: string;
  company: string;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  description: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  applicationUrl: string;
  postedAt: Date | null;
  expiresAt: Date | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  contentHash: string;
}

export type NormalizeResult =
  | { ok: true; opening: NormalizedOpening }
  | { ok: false; externalId: string | null; reason: string };

const MAX_TEXT = 20_000;
const MAX_SKILLS = 40;

/** Casefolded, punctuation-stripped form used for identity and skill lookups. */
export { normalizeText };

function str(record: unknown, path: string | undefined): string | null {
  if (!path) return null;
  const value = readPath(record, path);
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function list(record: unknown, path: string | undefined): string[] {
  if (!path) return [];
  const value = readPath(record, path);
  const raw = Array.isArray(value)
    ? value
    // A comma- or pipe-separated string is the other common feed shape.
    : typeof value === "string" ? value.split(/[,;|]/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim().slice(0, 120);
    const key = normalizeText(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_SKILLS) break;
  }
  return out;
}

function money(record: unknown, path: string | undefined): number | null {
  if (!path) return null;
  const value = readPath(record, path);
  let parsed = NaN;
  if (typeof value === "number") parsed = value;
  else if (typeof value === "string") {
    // Strip formatting, but a string with no digits left is absent, not zero:
    // `Number("")` is 0, which would advertise an unpaid role.
    const digits = value.replace(/[^0-9.-]/g, "");
    parsed = digits === "" || digits === "-" || digits === "." ? NaN : Number(digits);
  }
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1e12) return null;
  return Math.round(parsed);
}

function when(record: unknown, path: string | undefined): Date | null {
  const raw = str(record, path);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  // A date centuries out is a parsing accident, not a posting date.
  const year = parsed.getUTCFullYear();
  return year >= 2000 && year <= 2100 ? parsed : null;
}

export function parseWorkMode(value: string | null): WorkMode {
  const text = normalizeText(value ?? "");
  if (!text) return "UNSPECIFIED";
  if (/\bhybrid\b|\bhibrida\b/.test(text)) return "HYBRID";
  if (/\bremote\b|\bwfh\b|work from home\b|\bjarak jauh\b/.test(text)) return "REMOTE";
  if (/\bon ?site\b|\bwfo\b|\bin office\b|\bdi kantor\b/.test(text)) return "ONSITE";
  return "UNSPECIFIED";
}

export function parseEmploymentType(value: string | null): EmploymentType {
  const text = normalizeText(value ?? "");
  if (!text) return "UNSPECIFIED";
  if (/\bintern(ship)?\b|\bmagang\b/.test(text)) return "INTERNSHIP";
  if (/\bfreelance\b|\blepas\b/.test(text)) return "FREELANCE";
  if (/\bcontract\b|\bkontrak\b/.test(text)) return "CONTRACT";
  if (/\btemp(orary)?\b|\bsementara\b/.test(text)) return "TEMPORARY";
  if (/\bpart ?time\b|\bparuh waktu\b/.test(text)) return "PART_TIME";
  if (/\bfull ?time\b|\bpenuh waktu\b|\bpermanent\b|\btetap\b/.test(text)) return "FULL_TIME";
  return "UNSPECIFIED";
}

/**
 * Application links are the one field a participant will click, so they are
 * held to the same rule as every other outbound link in the product: HTTPS,
 * no embedded credentials, no javascript/data smuggling.
 */
export function safeApplicationUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href.slice(0, 2048);
  } catch {
    return null;
  }
}

/**
 * Our own identity for a role, independent of any provider's id.
 *
 * Two boards listing the same opening give it two unrelated ids; comparing
 * those would report duplicates as distinct jobs. Title, company and location
 * normalized together is a blunt instrument, but it is honest about what it
 * compares and it is stable across syncs.
 */
export function canonicalKey(input: { title: string; company: string; location: string | null }): string {
  const basis = [normalizeText(input.title), normalizeText(input.company), normalizeText(input.location ?? "")].join("|");
  return createHash("sha256").update(basis).digest("hex").slice(0, 40);
}

/** Hash of everything a reader would notice changing. Drives update-vs-no-op. */
export function contentHash(opening: Omit<NormalizedOpening, "contentHash">): string {
  const stable = {
    title: opening.title, company: opening.company, location: opening.location,
    workMode: opening.workMode, employmentType: opening.employmentType, description: opening.description,
    requiredSkills: opening.requiredSkills, preferredSkills: opening.preferredSkills,
    applicationUrl: opening.applicationUrl,
    postedAt: opening.postedAt?.toISOString() ?? null, expiresAt: opening.expiresAt?.toISOString() ?? null,
    salaryMin: opening.salaryMin, salaryMax: opening.salaryMax,
    salaryCurrency: opening.salaryCurrency, salaryPeriod: opening.salaryPeriod,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function normalizeOpening(record: unknown, fieldMap: FieldMap): NormalizeResult {
  const externalId = str(record, fieldMap.externalId);
  if (!externalId) return { ok: false, externalId: null, reason: "missing external id" };
  if (externalId.length > 200) return { ok: false, externalId: null, reason: "external id exceeds 200 characters" };

  const title = str(record, fieldMap.title);
  if (!title) return { ok: false, externalId, reason: "missing title" };
  const company = str(record, fieldMap.company);
  if (!company) return { ok: false, externalId, reason: "missing company" };

  const applicationUrl = safeApplicationUrl(str(record, fieldMap.applicationUrl));
  if (!applicationUrl) return { ok: false, externalId, reason: "missing or unsafe application URL" };

  const location = str(record, fieldMap.location)?.slice(0, 200) ?? null;
  let salaryMin = money(record, fieldMap.salaryMin);
  let salaryMax = money(record, fieldMap.salaryMax);
  // A feed that reports them the wrong way round is common enough to handle,
  // and a range check constraint would otherwise reject the whole record.
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) [salaryMin, salaryMax] = [salaryMax, salaryMin];

  const base = {
    externalId: externalId.slice(0, 200),
    canonicalKey: canonicalKey({ title, company, location }),
    title: title.slice(0, 300),
    company: company.slice(0, 300),
    location,
    workMode: parseWorkMode(str(record, fieldMap.workMode)),
    employmentType: parseEmploymentType(str(record, fieldMap.employmentType)),
    description: str(record, fieldMap.description)?.slice(0, MAX_TEXT) ?? null,
    requiredSkills: list(record, fieldMap.requiredSkills),
    preferredSkills: list(record, fieldMap.preferredSkills),
    applicationUrl,
    postedAt: when(record, fieldMap.postedAt),
    expiresAt: when(record, fieldMap.expiresAt),
    salaryMin,
    salaryMax,
    salaryCurrency: str(record, fieldMap.salaryCurrency)?.slice(0, 8).toUpperCase() ?? null,
    salaryPeriod: str(record, fieldMap.salaryPeriod)?.slice(0, 16).toUpperCase() ?? null,
  };
  return { ok: true, opening: { ...base, contentHash: contentHash(base) } };
}
