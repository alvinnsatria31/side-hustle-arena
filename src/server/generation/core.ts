import { createHash } from "node:crypto";
import { z } from "zod";
import { ArenaDomainError } from "@/server/arena/errors";
import { supportedFileMimeTypes } from "@/server/submissions/schemas";

const text = z.string().trim().min(10).max(12_000);
const label = z.string().trim().min(2).max(200);
const rubricSchema = z.object({
  name: label, description: text, weight: z.number().positive().max(100),
  maxScore: z.number().positive().max(100), reviewInstruction: text,
  /**
   * Which skill this criterion measures. Optional, and validated against the
   * division's skill list when present — an unattributed criterion is honest,
   * an attribution to a skill the project does not claim is a content bug.
   *
   * Outside `rubricHash` on purpose: attribution is editorial metadata, so
   * adding it to an existing project must not read as tampering with a frozen
   * base rubric.
   */
  skillId: z.uuid().nullish(),
}).strict();

export const packageSchema = z.object({
  divisionId: z.uuid(), title: label, shortDescription: text,
  caseBackground: text, roleDescription: text, objective: text, mission: text,
  difficulty: z.literal("STANDARD"), estimatedMinutes: z.number().int().min(120).max(960),
  skills: z.array(z.object({ skillId: z.uuid(), weight: z.number().positive().max(100) }).strict()).min(1).max(20),
  rubric: z.array(rubricSchema).min(1).max(20),
  requirements: z.array(z.object({
    label, type: z.enum(["FILE", "LINK"]), required: z.boolean(),
    minItems: z.number().int().min(0).max(5), maxItems: z.number().int().min(1).max(5),
    /**
     * Both lists default to empty because only one of them applies to any
     * given deliverable: a LINK has no MIME types, a FILE has no link types.
     * Requiring both keys on every requirement contradicted the generation
     * prompt, which asks for "allowedMimeTypes for FILE, allowedLinkTypes for
     * LINK" — the model omitted the inapplicable one, exactly as instructed,
     * and every package it produced was rejected for a missing key that had
     * nothing to describe.
     *
     * The real rule is enforced below in validatePackage, where a FILE
     * requirement with no MIME types is still refused. Defaulting here accepts
     * the natural shape without weakening that.
     */
    allowedMimeTypes: z.array(z.enum(supportedFileMimeTypes)).max(8).default([]),
    allowedLinkTypes: z.array(label).max(20).default([]), instructions: text,
  }).strict()).min(1).max(10),
  resources: z.array(z.object({ label, url: z.url().max(2048).refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Resources must use credential-free HTTPS URLs.") }).strict()).max(20),
  fingerprint: z.object({
    industry: label, role: label, coreSkill: label, secondarySkill: label,
    scenarioType: label, decisionType: label, primaryDeliverable: label,
    inputDataType: label, targetStakeholder: label, toolCategory: label,
  }).strict(),
}).strict();

export type ProjectPackage = z.infer<typeof packageSchema>;
export type BaseCriterion = Pick<ProjectPackage["rubric"][number], "name" | "weight" | "maxScore">;
export type GenerationContext = {
  divisionId: string; skillIds: string[]; baseRubric: BaseCriterion[];
  weekCode?: string; divisionName?: string;
};
export type LibraryEntry = { projectId: string; tag: "HIGH_QUALITY" | "EVERGREEN"; package: unknown };

/**
 * Markers that say "a human still has to write this".
 *
 * The bootstrap script fills fields a legacy project never had — case
 * background, role description, the ten fingerprint facets — with an obvious
 * marker rather than inventing curriculum prose, which is the right call. What
 * was wrong was tagging the result HIGH_QUALITY: that put it straight into the
 * fallback pool the generator publishes from when no provider is available, so
 * a participant could have opened a brief whose mission read
 * "[PLACEHOLDER] Misi belum ditulis".
 *
 * Structural validity and editorial readiness are different questions. This
 * answers the second one.
 */
const PLACEHOLDER_MARKERS = [/\[PLACEHOLDER\]/i, /\bTBD\b/, /\bTODO\b/, /\bLOREM IPSUM\b/i, /<[A-Z_]{3,}>/];

/** Every field of a package a reader would actually see. */
function editorialFields(p: ProjectPackage): string[] {
  return [
    p.title, p.shortDescription, p.caseBackground, p.roleDescription, p.objective, p.mission,
    ...p.rubric.flatMap((criterion) => [criterion.name, criterion.description, criterion.reviewInstruction]),
    ...p.requirements.flatMap((requirement) => [requirement.label, requirement.instructions]),
    ...p.resources.map((resource) => resource.label),
    ...Object.values(p.fingerprint),
  ];
}

/** Which visible fields still carry an unwritten marker. Empty means publishable. */
export function placeholderFields(p: ProjectPackage): string[] {
  return editorialFields(p).filter((value) => PLACEHOLDER_MARKERS.some((marker) => marker.test(value)));
}
export type GenerationProvider = {
  readonly name: string;
  generate(input: { context: GenerationContext; history: unknown[]; attempt: number; signal: AbortSignal }): Promise<unknown>;
};

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function contentHash(value: unknown): string {
  const stable = (item: unknown): unknown => Array.isArray(item) ? item.map(stable)
    : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : item;
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

export function rubricHash(rubric: BaseCriterion[]) {
  return contentHash(rubric.map(({ name, weight, maxScore }) => ({ name, weight, maxScore })));
}

/**
 * `allowPlaceholders` exists for exactly one caller: registering a
 * needs-curation library template, whose only job is to freeze a division's
 * base rubric so generation can start at all. Nothing that publishes, approves
 * or generates content may pass it.
 */
export function validatePackage(value: unknown, context: GenerationContext, options: { allowPlaceholders?: boolean } = {}): ProjectPackage {
  const result = packageSchema.safeParse(value);
  if (!result.success) throw new ArenaDomainError("VALIDATION_ERROR", "Project package failed validation.", {
    issues: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
  });
  const p = result.data;
  const invalid = (message: string) => { throw new ArenaDomainError("VALIDATION_ERROR", message); };
  if (p.divisionId !== context.divisionId) invalid("Package division does not match the requested division.");
  if (p.skills.some((s) => !context.skillIds.includes(s.skillId)) || new Set(p.skills.map((s) => s.skillId)).size !== p.skills.length) invalid("Unknown or duplicate skills.");
  // A criterion may only be attributed to a skill the project actually claims,
  // or finalization would write evidence for a skill the brief never mentions.
  const claimed = new Set(p.skills.map((s) => s.skillId));
  if (p.rubric.some((r) => r.skillId && !claimed.has(r.skillId))) invalid("A rubric criterion is attributed to a skill this project does not list.");
  if (rubricHash(p.rubric) !== rubricHash(context.baseRubric)) invalid("Base rubric criteria, order, weights and maximum scores are frozen.");
  if (new Set(p.rubric.map((r) => normalize(r.name))).size !== p.rubric.length) invalid("Duplicate rubric criteria.");
  if (!p.requirements.some((r) => r.required)) invalid("At least one deliverable is required.");
  for (const requirement of p.requirements) {
    if (requirement.minItems > requirement.maxItems || (requirement.required && requirement.minItems < 1)) invalid("Invalid deliverable item bounds.");
    if (requirement.type === "FILE" && !requirement.allowedMimeTypes.length) invalid("File requirements must name supported MIME types.");
  }
  for (const type of ["FILE", "LINK"]) {
    if (p.requirements.filter((r) => r.type === type).reduce((sum, r) => sum + r.minItems, 0) > 5) invalid("Required deliverables exceed the submission limit.");
  }
  const instructions = [p.mission, p.caseBackground, p.objective, ...p.requirements.map((r) => r.instructions)].join(" ");
  if (/\b(must|required|wajib|harus)\b.{0,50}\b(confidential|rahasia|paid subscription|berbayar|video)\b/i.test(instructions)) invalid("Project requires unsupported or restricted materials.");
  if (!options.allowPlaceholders) {
    const unwritten = placeholderFields(p);
    if (unwritten.length) invalid(`Package still contains unwritten placeholder content in ${unwritten.length} field(s); the first is "${unwritten[0].slice(0, 80)}".`);
  }
  return p;
}

export function fingerprint(p: ProjectPackage) {
  const dimensions = Object.fromEntries(Object.entries({ divisionId: p.divisionId, difficulty: p.difficulty, ...p.fingerprint }).map(([key, value]) => [key, normalize(value)]));
  return { dimensions, hash: contentHash(dimensions) };
}

type HistoryPackage = Pick<ProjectPackage, "divisionId" | "mission" | "objective" | "caseBackground"> & Partial<Pick<ProjectPackage, "fingerprint" | "difficulty">>;
export function isDuplicate(candidate: ProjectPackage, history: HistoryPackage[], threshold = 0.8): boolean {
  const tokens = (p: HistoryPackage) => new Set(normalize([p.mission, p.objective, p.caseBackground].join(" ")).split(" ").filter((t) => t.length > 2));
  const candidateTokens = tokens(candidate);
  return history.some((old) => {
    if (old.divisionId !== candidate.divisionId) return false;
    if (old.fingerprint) {
      const entries = Object.entries(candidate.fingerprint);
      const same = entries.filter(([key, value]) => normalize(value) === normalize(old.fingerprint![key as keyof typeof old.fingerprint])).length;
      if (same / entries.length >= threshold) return true;
    }
    const oldTokens = tokens(old);
    const intersection = [...candidateTokens].filter((t) => oldTokens.has(t)).length;
    return intersection / Math.max(1, new Set([...candidateTokens, ...oldTokens]).size) >= threshold;
  });
}

export async function chooseCandidate(input: {
  context: GenerationContext; history: HistoryPackage[]; library: LibraryEntry[];
  provider?: GenerationProvider; threshold?: number; timeoutMs?: number;
}) {
  const attempts: Array<{ attempt: number; outcome: string; reason?: string; issues?: string[] }> = [];
  const rejectedLibrary: Array<{ projectId: string; reason: string }> = [];
  const validate = (value: unknown) => {
    const p = validatePackage(value, input.context);
    if (isDuplicate(p, input.history, input.threshold)) throw new ArenaDomainError("VALIDATION_ERROR", "Recent project duplicate.");
    return p;
  };
  if (input.provider) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const abort = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error("timeout")); }, input.timeoutMs ?? 15_000); });
        const output = await Promise.race([input.provider.generate({ context: input.context, history: input.history, attempt, signal: abort.signal }), timeout]);
        const p = validate(output);
        attempts.push({ attempt, outcome: "validated" });
        return { source: "provider" as const, provider: input.provider.name, package: p, attempts, rejectedLibrary };
      } catch (error) {
        // Timeout is called out separately because it is the one failure the
        // operator causes and can fix. Folded into `provider_failed` it reads
        // as a broken provider, and a week held by a deadline that is simply
        // too short looks identical to one held by an outage.
        const outcome = error instanceof ArenaDomainError ? "invalid_or_duplicate"
          : error instanceof Error && error.message === "timeout" ? "provider_timeout"
          : "provider_failed";
        // Carry the reason, for the same argument the library loop below makes
        // and this branch never applied: "invalid_or_duplicate" leaves an
        // operator unable to tell a rubric the model failed to copy from a
        // brief that came back too close to last week's. One says fix the
        // prompt, the other says the division is out of ideas.
        //
        // Only OUR rejection text is recorded. A provider's exception message
        // is attacker- and vendor-controlled and can carry a key in a URL, an
        // internal hostname, or a token echoed back in an error body — none of
        // which may reach an audit row that operators read and export. So an
        // ArenaDomainError, which this module wrote, is quoted; anything the
        // provider threw is counted and its message dropped.
        //
        // The schema failure needs its `issues` as well as its message: every
        // Zod rejection carries the same sentence, so the message alone says
        // only "the shape was wrong somewhere" — the field paths are the part
        // that names which key the model got wrong.
        if (error instanceof ArenaDomainError) {
          const issues = error.details?.issues as Array<{ path: string; message: string }> | undefined;
          attempts.push({
            attempt, outcome, reason: error.message,
            ...(issues?.length ? { issues: issues.slice(0, 8).map((i) => `${i.path}: ${i.message}`) } : {}),
          });
        } else {
          attempts.push({ attempt, outcome });
        }
      } finally { if (timer) clearTimeout(timer); }
    }
  }
  for (const entry of [...input.library].sort((a, b) => Number(a.tag === "EVERGREEN") - Number(b.tag === "EVERGREEN"))) {
    try {
      return { source: "library" as const, sourceProjectId: entry.projectId, libraryTag: entry.tag,
        package: validate(entry.package), attempts, rejectedLibrary };
    } catch (error) {
      // Keep the actual reason. "invalid_or_duplicate" told an operator staring
      // at a held week nothing about whether the template was a duplicate, was
      // structurally broken, or was still full of unwritten placeholder text.
      rejectedLibrary.push({
        projectId: entry.projectId,
        reason: error instanceof ArenaDomainError ? error.message : "invalid_or_duplicate",
      });
    }
  }
  return { source: "failed" as const, attempts, rejectedLibrary };
}

export function publicationBlock(input: {
  week: { status: string; opensAt: Date; submissionDeadlineAt: Date };
  project: { status: string; previewStatus: string; scheduledPublishAt: Date | null };
  now: Date; validatedAt: Date; previewHours: number;
}): string | null {
  const { week, project, now } = input;
  if (!["DRAFT", "PREVIEW", "SCHEDULED"].includes(week.status)) return "Week is not awaiting publication.";
  if (now >= week.submissionDeadlineAt) return "Submission deadline has passed.";
  if (now < week.opensAt || !project.scheduledPublishAt || now < project.scheduledPublishAt) return "Publication is not due.";
  if (["REJECTED", "REGENERATE_REQUESTED"].includes(project.previewStatus) || project.status === "REJECTED") return "Project is vetoed or awaiting regeneration.";
  if (!["PREVIEWED", "SCHEDULED"].includes(project.status)) return "Project has not entered preview.";
  if (!["PENDING", "APPROVED", "AUTO_APPROVED"].includes(project.previewStatus)) return "Preview state is invalid.";
  if (project.previewStatus !== "APPROVED" && now.getTime() - input.validatedAt.getTime() < input.previewHours * 3_600_000) return "Minimum preview interval has not elapsed.";
  return null;
}

export function weeklyWindow(now: Date) {
  const day = 86_400_000;
  const local = new Date(now.getTime() + 7 * 3_600_000);
  const weekday = local.getUTCDay();
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + (weekday === 0 ? 1 : 1 - weekday));
  return {
    weekCode: `ARENA-${new Date(monday).toISOString().slice(0, 10)}`,
    title: `Arena week of ${new Date(monday).toISOString().slice(0, 10)}`,
    previewAt: new Date(monday - day + 2 * 3_600_000),
    opensAt: new Date(monday + 3_600_000),
    submissionDeadlineAt: new Date(monday + 5 * day - 7 * 3_600_000 - 1),
    timezone: "Asia/Jakarta",
  };
}

export function generationConfig(env: NodeJS.ProcessEnv = process.env) {
  const number = (key: string, fallback: number, min: number, max: number) => {
    // An empty or whitespace-only value means "unset", not zero. `.env.example`
    // ships these keys blank, so copying it forward must fall back to the
    // default rather than fail every generation with Number("") === 0.
    const raw = env[key];
    const value = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) throw new ArenaDomainError("VALIDATION_ERROR", `Invalid ${key} configuration.`);
    return value;
  };
  return {
    enabled: env.ARENA_GENERATION_ENABLED === "true", autoPublish: env.ARENA_AUTO_PUBLISH_ENABLED === "true",
    windowWeeks: number("ARENA_GENERATION_WINDOW_WEEKS", 12, 8, 12),
    threshold: number("ARENA_GENERATION_SIMILARITY_THRESHOLD", 0.8, 0.5, 1),
    previewHours: number("ARENA_GENERATION_PREVIEW_HOURS", 6, 1, 48),
    /**
     * How long one provider attempt may take.
     *
     * The 15s default this replaces made generation impossible rather than
     * slow: writing a whole project package — case background, role, mission,
     * objective, rubric prose, requirements, resources — is a large completion,
     * and a reasoning model cannot finish it in fifteen seconds. Every attempt
     * aborted mid-flight and was recorded as `provider_failed`, which reads
     * like a broken provider rather than a deadline the caller set.
     *
     * Generation runs in a scheduled job, not a page request, so nobody is
     * waiting on it. The real bound is the job's own execution budget.
     */
    providerTimeoutMs: number("ARENA_GENERATION_TIMEOUT_MS", 90_000, 15_000, 240_000),
  };
}
