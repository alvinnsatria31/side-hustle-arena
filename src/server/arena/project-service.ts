import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { divisions, projectRubricCriteria, projectSkills, projectSubmissionRequirements, projects, skills, weeks } from "../db/schema";
import { ArenaDomainError } from "./errors";
import { getWeekSelectionState, resolveCurrentWeekFromCandidates, type WeekCandidate } from "./week-service";

const currentWeekStatuses = ["OPEN", "SCHEDULED", "PREVIEW", "CLOSED", "FINALIZING", "FINALIZED"] as const;

function toWeekCandidate(week: typeof weeks.$inferSelect): WeekCandidate {
  return {
    id: week.id,
    status: week.status,
    opensAt: week.opensAt,
    submissionDeadlineAt: week.submissionDeadlineAt,
    closedAt: week.closedAt,
    finalizationStartedAt: week.finalizationStartedAt,
    finalizedAt: week.finalizedAt,
  };
}

function toCurrentWeek(week: typeof weeks.$inferSelect, now: Date) {
  return {
    id: week.id,
    weekCode: week.weekCode,
    title: week.title,
    status: week.status,
    opensAt: week.opensAt,
    submissionDeadlineAt: week.submissionDeadlineAt,
    timezone: week.timezone,
    selection: getWeekSelectionState(toWeekCandidate(week), now),
  };
}

export async function getCurrentArenaWeek({ now = new Date() }: { now?: Date } = {}) {
  const rows = await getDb().select().from(weeks).where(inArray(weeks.status, currentWeekStatuses));
  const selected = resolveCurrentWeekFromCandidates(rows.map(toWeekCandidate), now);
  if (!selected) throw new ArenaDomainError("WEEK_NOT_FOUND", "No current Arena week is available.");
  const week = rows.find((row) => row.id === selected.id);
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "No current Arena week is available.");
  return toCurrentWeek(week, now);
}

export async function listActiveArenaDivisions() {
  return getDb().select({
    id: divisions.id,
    slug: divisions.slug,
    name: divisions.name,
    description: divisions.description,
    sortOrder: divisions.sortOrder,
  }).from(divisions).where(eq(divisions.isActive, true)).orderBy(asc(divisions.sortOrder), asc(divisions.name));
}

function toProjectSummary(row: { project: typeof projects.$inferSelect; division: typeof divisions.$inferSelect }) {
  return {
    id: row.project.id,
    slug: row.project.slug,
    title: row.project.title,
    shortDescription: row.project.shortDescription,
    difficulty: row.project.difficulty,
    estimatedMinutes: row.project.estimatedMinutes,
    division: {
      id: row.division.id,
      slug: row.division.slug,
      name: row.division.name,
    },
  };
}

async function getVisibleProjectRows(input: { now?: Date; divisionSlug?: string; slug?: string }) {
  const current = await getCurrentArenaWeek({ now: input.now });
  const conditions = [
    eq(projects.weekId, current.id),
    eq(projects.status, "PUBLISHED"),
    eq(divisions.isActive, true),
  ];
  if (input.divisionSlug) conditions.push(eq(divisions.slug, input.divisionSlug));
  if (input.slug) conditions.push(eq(projects.slug, input.slug));

  return getDb().select({ project: projects, division: divisions }).from(projects)
    .innerJoin(divisions, eq(projects.divisionId, divisions.id))
    .where(and(...conditions))
    .orderBy(asc(divisions.sortOrder), asc(projects.title));
}

export async function listVisibleArenaProjects(input: { now?: Date; divisionSlug?: string } = {}) {
  const rows = await getVisibleProjectRows(input);
  return rows.map(toProjectSummary);
}

export async function getVisibleArenaProject({ slug, now = new Date() }: { slug: string; now?: Date }) {
  const row = (await getVisibleProjectRows({ now, slug }))[0];
  if (!row) throw new ArenaDomainError("PROJECT_NOT_FOUND", "Project not found.");

  const [projectSkillsRows, rubricRows, requirementRows] = await Promise.all([
    getDb().select({
      slug: skills.slug,
      name: skills.name,
      category: skills.category,
      weight: projectSkills.weight,
    }).from(projectSkills).innerJoin(skills, eq(projectSkills.skillId, skills.id)).where(eq(projectSkills.projectId, row.project.id)).orderBy(asc(skills.name)),
    getDb().select({
      id: projectRubricCriteria.id,
      name: projectRubricCriteria.name,
      description: projectRubricCriteria.description,
      weight: projectRubricCriteria.weight,
      maxScore: projectRubricCriteria.maxScore,
      reviewInstruction: projectRubricCriteria.reviewInstruction,
      sortOrder: projectRubricCriteria.sortOrder,
    }).from(projectRubricCriteria).where(eq(projectRubricCriteria.projectId, row.project.id)).orderBy(asc(projectRubricCriteria.sortOrder), asc(projectRubricCriteria.name)),
    getDb().select({
      id: projectSubmissionRequirements.id,
      label: projectSubmissionRequirements.label,
      type: projectSubmissionRequirements.type,
      required: projectSubmissionRequirements.required,
      minItems: projectSubmissionRequirements.minItems,
      maxItems: projectSubmissionRequirements.maxItems,
      allowedMimeTypes: projectSubmissionRequirements.allowedMimeTypes,
      allowedLinkTypes: projectSubmissionRequirements.allowedLinkTypes,
      instructions: projectSubmissionRequirements.instructions,
      sortOrder: projectSubmissionRequirements.sortOrder,
    }).from(projectSubmissionRequirements).where(eq(projectSubmissionRequirements.projectId, row.project.id)).orderBy(asc(projectSubmissionRequirements.sortOrder), asc(projectSubmissionRequirements.label)),
  ]);

  return {
    ...toProjectSummary(row),
    caseBackground: row.project.caseBackground,
    roleDescription: row.project.roleDescription,
    mission: row.project.mission,
    objective: row.project.objective,
    skills: projectSkillsRows,
    rubric: rubricRows,
    requirements: requirementRows,
  };
}
