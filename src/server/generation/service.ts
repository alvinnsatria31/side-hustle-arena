import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { divisions, featureFlags, logs, projects, projectRubricCriteria, projectSkills, projectSubmissionRequirements, runs, skills, weekRules, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { chooseCandidate, contentHash, fingerprint, generationConfig, isDuplicate, publicationBlock, rubricHash, validatePackage, weeklyWindow,
  type BaseCriterion, type GenerationProvider, type LibraryEntry, type ProjectPackage } from "./core";
import { EXECUTION_CONTRACT, type ExecutionBudget } from "@/server/ops/execution-budget";

type Db = ReturnType<typeof getDb>;
type Store = Pick<Db, "select" | "insert" | "update" | "delete" | "execute">;
type Actor = { actorSubject: string; actorType?: "ADMIN" | "AUTOMATION" };
type Options = Actor & { db?: Db; now?: Date };
type ValidationRecord = { package: ProjectPackage; contentHash: string; baseRubricHash: string; source: string; sourceProjectId?: string };
/**
 * NEEDS_CURATION is a real state, not a synonym for RETIRED: the template is
 * structurally valid and its rubric is authoritative (that is what unblocks
 * generation for the division), but its prose is still unwritten. It is
 * excluded from the fallback pool, so it can never be published to a
 * participant, and it becomes usable only when a curator replaces the
 * placeholder text and re-tags it — which the strict validator enforces.
 */
type LibraryRecord = { tag: "HIGH_QUALITY" | "EVERGREEN" | "NEEDS_CURATION" | "RETIRED"; package: ProjectPackage };

// The global transaction lock covers only local writes; provider calls happen outside it.
async function locked<T>(db: Db, fn: (tx: Store) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('arena-project-lifecycle'))`);
    return fn(tx);
  });
}

async function audit(db: Store, actor: Actor, action: string, entityType: string, entityId: string, metadata: unknown, now: Date) {
  await db.insert(logs).values({ actorType: actor.actorType ?? "ADMIN", actorSubject: actor.actorSubject,
    action: `generation.${action}`, entityType, entityId, metadata, createdAt: now });
}

async function weekState(db: Store, weekId: string, mutable = false, now = new Date()) {
  const [week] = await db.select().from(weeks).where(eq(weeks.id, weekId)).for("update");
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Week not found.");
  if (mutable && (!["DRAFT", "PREVIEW", "SCHEDULED"].includes(week.status) || now >= week.submissionDeadlineAt)) {
    throw new ArenaDomainError("WEEK_NOT_READY", "Week cannot accept project changes in its current state or after its deadline.");
  }
  const [rules] = await db.select().from(weekRules).where(eq(weekRules.weekId, weekId));
  if (!rules || rules.difficultyBand !== "STANDARD" || rules.maxProjectsPerUser !== 1 || rules.maxReviewAttempts < 1
    || rules.leaderboardScope !== "GLOBAL" || rules.tieBreakMethod !== "EARLIEST_FINAL_SUBMISSION"
    || !Number.isFinite(week.opensAt.getTime()) || week.submissionDeadlineAt <= week.opensAt) {
    throw new ArenaDomainError("WEEK_NOT_READY", "Week dates or rules are missing or incompatible with project generation.");
  }
  return { week, rules };
}

async function projectRow(db: Store, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new ArenaDomainError("PROJECT_NOT_FOUND", "Project not found.");
  return project;
}

async function validationRecord(db: Store, projectId: string) {
  const [row] = await db.select().from(logs).where(and(eq(logs.action, "generation.validated"), eq(logs.entityId, projectId)))
    .orderBy(desc(logs.createdAt), desc(logs.id)).limit(1);
  if (!row) return null;
  return { ...row, metadata: row.metadata as ValidationRecord };
}

async function storedPackage(db: Store, project: typeof projects.$inferSelect, supplemental?: ProjectPackage): Promise<ProjectPackage> {
  const rubric = await db.select().from(projectRubricCriteria).where(eq(projectRubricCriteria.projectId, project.id)).orderBy(asc(projectRubricCriteria.sortOrder));
  const requirements = await db.select().from(projectSubmissionRequirements).where(eq(projectSubmissionRequirements.projectId, project.id)).orderBy(asc(projectSubmissionRequirements.sortOrder));
  const projectSkillRows = await db.select().from(projectSkills).where(eq(projectSkills.projectId, project.id)).orderBy(asc(projectSkills.skillId));
  // Nullable legacy content remains invalid. It is never filled with invented AI output.
  return {
    divisionId: project.divisionId, title: project.title, shortDescription: project.shortDescription ?? "",
    caseBackground: project.caseBackground ?? "", roleDescription: project.roleDescription ?? "",
    mission: project.mission ?? "", objective: project.objective ?? "", difficulty: project.difficulty,
    estimatedMinutes: project.estimatedMinutes ?? 0,
    skills: projectSkillRows.map((s) => ({ skillId: s.skillId, weight: Number(s.weight ?? 1) })),
    rubric: rubric.map((r) => ({ name: r.name, description: r.description ?? "", weight: Number(r.weight), maxScore: Number(r.maxScore), reviewInstruction: r.reviewInstruction ?? "", skillId: r.skillId })),
    requirements: requirements.map((r) => ({ label: r.label, type: r.type as "FILE" | "LINK", required: r.required,
      minItems: r.minItems, maxItems: r.maxItems, allowedMimeTypes: r.allowedMimeTypes ?? [], allowedLinkTypes: r.allowedLinkTypes ?? [], instructions: r.instructions ?? "" })) as ProjectPackage["requirements"],
    resources: supplemental?.resources ?? [], fingerprint: supplemental?.fingerprint as ProjectPackage["fingerprint"],
  };
}

function ordered(p: ProjectPackage): ProjectPackage {
  return { ...p, skills: [...p.skills].sort((a, b) => a.skillId.localeCompare(b.skillId)) };
}

async function baseRubric(db: Store, divisionId: string): Promise<BaseCriterion[] | null> {
  const [row] = await db.select().from(logs).where(and(eq(logs.action, "generation.rubric-frozen"), eq(logs.entityId, divisionId))).orderBy(asc(logs.createdAt)).limit(1);
  return row ? (row.metadata as { rubric: BaseCriterion[] }).rubric : null;
}

async function contextFor(db: Store, divisionId: string, weekCode?: string) {
  const [division] = await db.select().from(divisions).where(and(eq(divisions.id, divisionId), eq(divisions.isActive, true)));
  if (!division) throw new ArenaDomainError("VALIDATION_ERROR", "Division is missing or inactive.");
  const rubric = await baseRubric(db, divisionId);
  if (!rubric) throw new ArenaDomainError("WEEK_NOT_READY", "Register a validated library template to establish this division's base rubric.");
  const skillRows = await db.select({ id: skills.id }).from(skills);
  return { divisionId, divisionName: division.name, weekCode, skillIds: skillRows.map((s) => s.id), baseRubric: rubric };
}

async function libraryEntries(db: Store, divisionId: string): Promise<LibraryEntry[]> {
  const rows = await db.select().from(logs).where(eq(logs.action, "generation.library-tagged")).orderBy(desc(logs.createdAt), desc(logs.id)).limit(2001);
  if (rows.length > 2000) throw new ArenaDomainError("WEEK_NOT_READY", "Library history requires pagination before generation can proceed.");
  const seen = new Set<string>();
  const result: LibraryEntry[] = [];
  for (const row of rows) {
    if (!row.entityId || seen.has(row.entityId)) continue;
    seen.add(row.entityId);
    const record = row.metadata as LibraryRecord;
    // Only curated tags may be chosen as a generation candidate.
    if ((record.tag === "HIGH_QUALITY" || record.tag === "EVERGREEN") && record.package.divisionId === divisionId) {
      result.push({ projectId: row.entityId, tag: record.tag, package: record.package });
    }
  }
  return result;
}

async function recentHistory(db: Store, week: typeof weeks.$inferSelect, excludeProjectId?: string) {
  const since = new Date(week.opensAt.getTime() - generationConfig().windowWeeks * 7 * 86_400_000);
  const rows = await db.select({ project: projects }).from(projects).innerJoin(weeks, eq(projects.weekId, weeks.id))
    .where(and(gte(weeks.opensAt, since), lte(weeks.opensAt, week.opensAt), inArray(projects.status, ["PUBLISHED", "ARCHIVED", "PREVIEWED", "SCHEDULED"]))).limit(1001);
  if (rows.length > 1000) throw new ArenaDomainError("WEEK_NOT_READY", "Recent project history exceeds the bounded scan; publication is held.");
  const result = [];
  for (const { project } of rows) {
    if (project.id === excludeProjectId) continue;
    const validation = await validationRecord(db, project.id);
    result.push({ divisionId: project.divisionId, mission: project.mission ?? "", objective: project.objective ?? "", caseBackground: project.caseBackground ?? "",
      fingerprint: validation?.metadata.package.fingerprint, difficulty: project.difficulty });
  }
  return result;
}

async function writeContent(db: Store, projectId: string, p: ProjectPackage) {
  await db.delete(projectSkills).where(eq(projectSkills.projectId, projectId));
  await db.delete(projectRubricCriteria).where(eq(projectRubricCriteria.projectId, projectId));
  await db.delete(projectSubmissionRequirements).where(eq(projectSubmissionRequirements.projectId, projectId));
  await db.insert(projectSkills).values(p.skills.map((s) => ({ projectId, skillId: s.skillId, weight: String(s.weight) })));
  await db.insert(projectRubricCriteria).values(p.rubric.map((r, sortOrder) => ({ ...r, projectId, sortOrder, weight: String(r.weight), maxScore: String(r.maxScore), skillId: r.skillId ?? null })));
  await db.insert(projectSubmissionRequirements).values(p.requirements.map((r, sortOrder) => ({ ...r, projectId, sortOrder })));
}

function projectFields(p: ProjectPackage) {
  return { divisionId: p.divisionId, title: p.title, shortDescription: p.shortDescription, caseBackground: p.caseBackground,
    roleDescription: p.roleDescription, mission: p.mission, objective: p.objective, difficulty: p.difficulty, estimatedMinutes: p.estimatedMinutes };
}

async function recordValidation(db: Store, actor: Actor, projectId: string, p: ProjectPackage, provenance: { source: string; sourceProjectId?: string }, now: Date) {
  await audit(db, actor, "validated", "project", projectId, { ...provenance, package: p, contentHash: contentHash(p),
    baseRubricHash: rubricHash(p.rubric), fingerprint: fingerprint(p), validatorVersion: "arena-generation-v1" }, now);
}

/** Curate an existing stored project. A supplied package may enrich incomplete legacy templates. */
export async function registerLibraryTemplate(input: Options & { projectId: string; tag: LibraryRecord["tag"]; package?: unknown; reason: string }) {
  const db = input.db ?? getDb(); const now = input.now ?? new Date();
  return locked(db, async (tx) => {
    const project = await projectRow(tx, input.projectId);
    if (!["PUBLISHED", "ARCHIVED"].includes(project.status)) throw new ArenaDomainError("VALIDATION_ERROR", "Library sources must be published or archived projects.");
    const existing = await validationRecord(tx, project.id);
    const stored = await storedPackage(tx, project, existing?.metadata.package);
    if (input.tag === "RETIRED") {
      await audit(tx, input, "library-tagged", "project_library", project.id, { tag: input.tag, package: stored, reason: input.reason }, now);
      return { projectId: project.id, tag: input.tag };
    }
    const frozen = await baseRubric(tx, project.divisionId);
    const skillRows = await tx.select({ id: skills.id }).from(skills);
    // Placeholder prose is tolerated only for a NEEDS_CURATION registration,
    // whose purpose is to freeze the base rubric. Promoting the same template
    // to HIGH_QUALITY or EVERGREEN runs the strict validator, so a curator
    // cannot mark unwritten content publishable by changing one word.
    const p = ordered(validatePackage(
      input.package ?? stored,
      { divisionId: project.divisionId, skillIds: skillRows.map((s) => s.id), baseRubric: frozen ?? stored.rubric },
      { allowPlaceholders: input.tag === "NEEDS_CURATION" },
    ));
    if (!frozen) await audit(tx, input, "rubric-frozen", "division", project.divisionId, { rubric: p.rubric.map(({ name, weight, maxScore }) => ({ name, weight, maxScore })), sourceProjectId: project.id }, now);
    await audit(tx, input, "library-tagged", "project_library", project.id, { tag: input.tag, package: p, reason: input.reason,
      contentHash: contentHash(p), baseRubricHash: rubricHash(p.rubric) }, now);
    return { projectId: project.id, tag: input.tag, fingerprint: fingerprint(p) };
  });
}

/** The injected provider hook may call the parent's generic AI adapter. No provider means library-only. */
export async function generateDivision(input: Options & { weekId: string; divisionId: string; provider?: GenerationProvider }) {
  const db = input.db ?? getDb(); const now = input.now ?? new Date();
  const prepared = await locked(db, async (tx) => {
    const { week } = await weekState(tx, input.weekId, true, now);
    const existing = await tx.select().from(projects).where(and(eq(projects.weekId, week.id), eq(projects.divisionId, input.divisionId))).orderBy(desc(projects.createdAt), desc(projects.id));
    const current = existing.find((p) => p.status !== "ARCHIVED");
    if (current && current.previewStatus !== "REGENERATE_REQUESTED") return { skipped: current.previewStatus === "REJECTED" ? "division vetoed" : "division already prepared", projectId: current.id };
    const context = await contextFor(tx, input.divisionId, week.weekCode);
    const key = `generation:${week.weekCode}:${input.divisionId}:${current?.id ?? "initial"}`;
    const [run] = await tx.select().from(runs).where(eq(runs.idempotencyKey, key));
    if (run?.status === "RUNNING" && run.startedAt.getTime() > now.getTime() - 5 * 60_000) return { skipped: "generation already running" };
    const [claimed] = await tx.insert(runs).values({ type: "PROJECT_GENERATION", weekId: week.id, idempotencyKey: key, status: "RUNNING", itemsTotal: 1, startedAt: now })
      .onConflictDoUpdate({ target: runs.idempotencyKey, set: { status: "RUNNING", startedAt: now, completedAt: null, itemsSuccess: 0, itemsFailed: 0, errorSummary: null, updatedAt: now } }).returning();
    await audit(tx, input, "started", "automation_run", claimed.id, { weekId: week.id, divisionId: input.divisionId }, now);
    return { week, context, run: claimed, previousId: current?.id, history: await recentHistory(tx, week), library: await libraryEntries(tx, input.divisionId) };
  });
  if (!("run" in prepared) || !prepared.run) return prepared;
  const chosen = await chooseCandidate({ context: prepared.context, history: prepared.history, library: prepared.library,
    provider: input.provider, threshold: generationConfig().threshold });
  return locked(db, async (tx) => {
    const [run] = await tx.select().from(runs).where(eq(runs.id, prepared.run.id));
    if (run?.status !== "RUNNING" || run.startedAt.getTime() !== prepared.run.startedAt.getTime()) return { skipped: "generation lease superseded" };
    const finishFailed = async (reason: string) => {
      await tx.update(runs).set({ status: "FAILED", itemsFailed: 1, completedAt: now, updatedAt: now, errorSummary: reason }).where(eq(runs.id, run.id));
      await audit(tx, input, "failed", "automation_run", run.id, { reason, attempts: chosen.attempts, rejectedLibrary: chosen.rejectedLibrary }, now);
      return { failed: reason, runId: run.id };
    };
    if (!chosen.package) return finishFailed("No validated nonduplicate provider or library package is available.");
    let week: typeof weeks.$inferSelect; let p: ProjectPackage;
    try {
      ({ week } = await weekState(tx, input.weekId, true, now));
      p = ordered(validatePackage(chosen.package, await contextFor(tx, input.divisionId, week.weekCode)));
      if (isDuplicate(p, await recentHistory(tx, week), generationConfig().threshold)) return finishFailed("Candidate became a recent duplicate before persistence.");
      if (chosen.source === "library") {
        const available = await libraryEntries(tx, input.divisionId);
        if (!available.some((entry) => entry.projectId === chosen.sourceProjectId && contentHash(entry.package) === contentHash(p))) return finishFailed("Library template changed or was retired during generation.");
      }
      const current = await tx.select().from(projects).where(and(eq(projects.weekId, week.id), eq(projects.divisionId, input.divisionId)));
      if (current.some((row) => row.id !== prepared.previousId && row.status !== "REJECTED" && row.status !== "ARCHIVED")) return finishFailed("Division was prepared by another operation.");
      if (prepared.previousId && current.find((row) => row.id === prepared.previousId)?.previewStatus !== "REGENERATE_REQUESTED") return finishFailed("Regeneration was vetoed or changed while running.");
    } catch (error) {
      if (error instanceof ArenaDomainError) return finishFailed(error.message);
      throw error;
    }
    if (prepared.previousId) await tx.update(projects).set({ status: "ARCHIVED", updatedAt: now }).where(eq(projects.id, prepared.previousId));
    const [project] = await tx.insert(projects).values({ ...projectFields(p), weekId: week.id,
      slug: `weekly-${week.weekCode.toLowerCase()}-${input.divisionId.slice(0, 8)}-${run.id.slice(0, 8)}`,
      status: "PREVIEWED", previewStatus: "PENDING", scheduledPublishAt: week.opensAt, automationRunId: run.id, createdAt: now, updatedAt: now }).returning();
    await writeContent(tx, project.id, p);
    await recordValidation(tx, input, project.id, p, { source: chosen.source, sourceProjectId: chosen.sourceProjectId }, now);
    await audit(tx, input, "previewed", "project", project.id, { runId: run.id, source: chosen.source, provider: chosen.provider,
      sourceProjectId: chosen.sourceProjectId, attempts: chosen.attempts, rejectedLibrary: chosen.rejectedLibrary }, now);
    await tx.update(runs).set({ status: "SUCCESS", itemsSuccess: 1, completedAt: now, updatedAt: now }).where(eq(runs.id, run.id));
    await tx.update(weeks).set({ status: "PREVIEW", previewAt: week.previewAt ?? now, updatedAt: now }).where(eq(weeks.id, week.id));
    return { projectId: project.id, runId: run.id, status: "PREVIEWED", source: chosen.source };
  });
}

/**
 * Generate every active division for a week, resumably.
 *
 * Six divisions, each allowed up to three provider attempts, cannot fit in one
 * 60s invocation — and the old loop had no idea it was inside one, so a slow
 * provider meant the request was killed partway through with no record of how
 * far it got. `generateDivision` is already idempotent per division (an
 * already-prepared division reports `skipped`), so the fix is not to make this
 * faster but to make it stop cleanly: take divisions while there is budget for
 * one more, commit what was done, and say plainly that a later tick continues.
 * That is why the generation trigger fires repeatedly during the Sunday
 * window rather than once.
 */
export async function generateWeek(input: Options & { weekId: string; divisionId?: string; provider?: GenerationProvider; budget?: ExecutionBudget }) {
  const db = input.db ?? getDb();
  const active = await db.select().from(divisions).where(eq(divisions.isActive, true)).orderBy(asc(divisions.sortOrder));
  const selected = input.divisionId ? active.filter((d) => d.id === input.divisionId) : active;
  if (!selected.length) throw new ArenaDomainError("WEEK_NOT_READY", "No active requested divisions exist.");
  const results = [];
  let remaining = 0;
  for (const division of selected) {
    if (input.budget && !input.budget.hasRoomFor(EXECUTION_CONTRACT.divisionBudgetMs)) {
      remaining = selected.length - results.length;
      break;
    }
    try { results.push({ divisionId: division.id, ...await generateDivision({ ...input, divisionId: division.id, db }) }); }
    catch (error) {
      if (!(error instanceof ArenaDomainError)) throw error;
      await audit(db, input, "blocked", "week", input.weekId, { divisionId: division.id, reason: error.message }, input.now ?? new Date());
      results.push({ divisionId: division.id, failed: error.message });
    }
  }
  return { weekId: input.weekId, results, ...(remaining ? { deferredDivisions: remaining } : {}) };
}

export async function previewWeek(input: { weekId: string; db?: Db }) {
  const db = input.db ?? getDb();
  const [week] = await db.select().from(weeks).where(eq(weeks.id, input.weekId));
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Week not found.");
  const projectRows = await db.select().from(projects).where(eq(projects.weekId, week.id)).orderBy(asc(projects.createdAt));
  const entries = [];
  for (const project of projectRows) {
    const validation = await validationRecord(db, project.id);
    entries.push({ project, package: await storedPackage(db, project, validation?.metadata.package), validation });
  }
  const automationRuns = await db.select().from(runs).where(eq(runs.weekId, week.id)).orderBy(desc(runs.startedAt));
  return { week, projects: entries, runs: automationRuns };
}

/**
 * One project with everything the console needs to edit it safely.
 *
 * The stored package is the only correct starting point for an edit: writing
 * project columns directly would leave the validation record's content hash
 * behind, and `publishWeek` refuses content that changed after validation. So
 * the editor round-trips this package back through `reviewProject`.
 */
export async function previewProject(input: { projectId: string; db?: Db }) {
  const db = input.db ?? getDb();
  const project = await projectRow(db, input.projectId);
  const [week] = await db.select().from(weeks).where(eq(weeks.id, project.weekId));
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Week not found.");
  const [division] = await db.select().from(divisions).where(eq(divisions.id, project.divisionId));
  const validation = await validationRecord(db, project.id);
  return {
    project, week, division: division ?? null,
    package: await storedPackage(db, project, validation?.metadata.package),
    validatedAt: validation?.createdAt ?? null,
    validationSource: validation?.metadata.source ?? null,
  };
}

export async function reviewProject(input: Options & { projectId: string; action: "approve" | "veto" | "regenerate" | "edit"; reason: string; package?: unknown }) {
  const db = input.db ?? getDb(); const now = input.now ?? new Date();
  return locked(db, async (tx) => {
    const project = await projectRow(tx, input.projectId);
    const { week } = await weekState(tx, project.weekId, true, now);
    if (["PUBLISHED", "ARCHIVED"].includes(project.status)) throw new ArenaDomainError("WEEK_NOT_READY", "Published or superseded content is immutable.");
    if (input.action === "edit" || input.action === "approve") {
      const validation = await validationRecord(tx, project.id);
      if (!validation) throw new ArenaDomainError("VALIDATION_ERROR", "Project has no validation record.");
      if (input.action === "approve" && ["REJECTED", "REGENERATE_REQUESTED"].includes(project.previewStatus)) throw new ArenaDomainError("WEEK_NOT_READY", "Edit or regenerate vetoed content before approval.");
      const persisted = await storedPackage(tx, project, validation.metadata.package);
      if (input.action === "approve" && contentHash(persisted) !== validation.metadata.contentHash) throw new ArenaDomainError("VALIDATION_ERROR", "Stored content changed since validation.");
      const p = ordered(validatePackage(input.action === "edit" ? input.package : persisted, await contextFor(tx, project.divisionId, week.weekCode)));
      if (isDuplicate(p, await recentHistory(tx, week, project.id), generationConfig().threshold)) throw new ArenaDomainError("VALIDATION_ERROR", "Recent project duplicate.");
      if (input.action === "edit") {
        await tx.update(projects).set({ ...projectFields(p), status: "PREVIEWED", previewStatus: "PENDING", scheduledPublishAt: week.opensAt, updatedAt: now }).where(eq(projects.id, project.id));
        await writeContent(tx, project.id, p);
        await recordValidation(tx, input, project.id, p, { source: "admin-edit" }, now);
      } else await tx.update(projects).set({ status: "SCHEDULED", previewStatus: "APPROVED", updatedAt: now }).where(eq(projects.id, project.id));
    } else {
      await tx.update(projects).set({ status: "REJECTED", previewStatus: input.action === "veto" ? "REJECTED" : "REGENERATE_REQUESTED", updatedAt: now }).where(eq(projects.id, project.id));
    }
    await audit(tx, input, input.action, "project", project.id, { reason: input.reason }, now);
    return { projectId: project.id, weekId: week.id, divisionId: project.divisionId, action: input.action };
  });
}

export async function publishWeek(input: Options & { weekId: string }) {
  const db = input.db ?? getDb(); const now = input.now ?? new Date();
  return locked(db, async (tx) => {
    // Read directly: failed maintenance reads must fail closed for publication.
    const [flag] = await tx.select().from(featureFlags).where(eq(featureFlags.key, "arena-publish")).for("share");
    if (flag?.maintenanceMode) throw new ArenaDomainError("FEATURE_CLOSED", flag.message ?? "Weekly publication is paused.");
    const { week } = await weekState(tx, input.weekId, false, now);
    if (week.status === "OPEN") return { weekId: week.id, skipped: "week already open", published: [], held: [] };
    if (!["DRAFT", "PREVIEW", "SCHEDULED"].includes(week.status)) throw new ArenaDomainError("WEEK_NOT_READY", "Week is not awaiting publication.");
    const rows = await tx.select().from(projects).where(eq(projects.weekId, week.id)).orderBy(asc(projects.createdAt));
    const published: string[] = []; const held: Array<{ projectId: string; reason: string }> = [];
    const valid: Array<{ project: typeof projects.$inferSelect; package: ProjectPackage }> = [];
    for (const project of rows.filter((p) => p.status !== "ARCHIVED")) {
      try {
        const validation = await validationRecord(tx, project.id);
        if (!validation) throw new ArenaDomainError("VALIDATION_ERROR", "No validation record exists.");
        const block = publicationBlock({ week, project, now, validatedAt: validation.createdAt, previewHours: generationConfig().previewHours });
        if (block) throw new ArenaDomainError("WEEK_NOT_READY", block);
        const p = ordered(validatePackage(await storedPackage(tx, project, validation.metadata.package), await contextFor(tx, project.divisionId, week.weekCode)));
        if (contentHash(p) !== validation.metadata.contentHash || rubricHash(p.rubric) !== validation.metadata.baseRubricHash) throw new ArenaDomainError("VALIDATION_ERROR", "Stored package changed after validation.");
        if (isDuplicate(p, await recentHistory(tx, week, project.id), generationConfig().threshold)) throw new ArenaDomainError("VALIDATION_ERROR", "Recent project duplicate.");
        if (valid.some((entry) => entry.project.divisionId === project.divisionId)) throw new ArenaDomainError("VALIDATION_ERROR", "Only one project per division may be published.");
        valid.push({ project, package: p });
      } catch (error) {
        if (!(error instanceof ArenaDomainError)) throw error;
        held.push({ projectId: project.id, reason: error.message });
      }
    }
    if (!valid.length) {
      await audit(tx, input, "publication-held", "week", week.id, { held }, now);
      return { weekId: week.id, published, held, skipped: "no publishable projects" };
    }
    for (const { project } of valid) {
      await tx.update(projects).set({ status: "PUBLISHED", publishedAt: now,
        previewStatus: project.previewStatus === "APPROVED" ? "APPROVED" : "AUTO_APPROVED", updatedAt: now }).where(eq(projects.id, project.id));
      await audit(tx, input, "published", "project", project.id, { weekId: week.id }, now);
      published.push(project.id);
    }
    await tx.update(weeks).set({ status: "OPEN", updatedAt: now }).where(eq(weeks.id, week.id));
    await tx.insert(runs).values({ type: "PROJECT_PUBLICATION", weekId: week.id, status: held.length ? "PARTIAL" : "SUCCESS",
      idempotencyKey: `publication:${week.weekCode}`, startedAt: now, completedAt: now,
      itemsTotal: published.length + held.length, itemsSuccess: published.length, itemsFailed: held.length }).onConflictDoNothing();
    await audit(tx, input, "week-opened", "week", week.id, { published, held, notifications: "not-dispatched" }, now);
    return { weekId: week.id, published, held };
  });
}

export async function prepareScheduledWeek(input: Options = { actorSubject: "scheduler", actorType: "AUTOMATION" }) {
  const now = input.now ?? new Date(); const window = weeklyWindow(now);
  if (now < window.previewAt || now >= window.opensAt) return { skipped: "outside the Sunday generation window" };
  const db = input.db ?? getDb();
  return locked(db, async (tx) => {
    const matching = await tx.select().from(weeks).where(and(gte(weeks.opensAt, new Date(window.opensAt.getTime() - 8 * 3_600_000)), lte(weeks.opensAt, new Date(window.opensAt.getTime() + 16 * 3_600_000))));
    if (matching.length > 1) throw new ArenaDomainError("WEEK_NOT_READY", "Multiple weeks overlap the scheduled release; select a week explicitly.");
    if (matching.length) {
      await weekState(tx, matching[0].id, true, now);
      return { weekId: matching[0].id, created: false };
    }
    const [week] = await tx.insert(weeks).values({ ...window, status: "DRAFT", createdAt: now, updatedAt: now }).returning();
    await tx.insert(weekRules).values({ weekId: week.id });
    await audit(tx, input, "week-prepared", "week", week.id, { weekCode: week.weekCode }, now);
    return { weekId: week.id, created: true };
  });
}
