import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { divisions, enrollments, projects, weekRules, weeks } from "../db/schema";
import { ArenaDomainError } from "./errors";
import { projectSelectionSchema } from "./schemas";
import { getWeekSelectionState, resolveCurrentWeekFromCandidates, type WeekCandidate } from "./week-service";

const currentWeekStatuses = ["OPEN", "SCHEDULED", "PREVIEW", "CLOSED", "FINALIZING", "FINALIZED"] as const;

function candidateFromRow(week: typeof weeks.$inferSelect): WeekCandidate {
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

async function findCurrentWeek(db: ReturnType<typeof getDb>, now: Date) {
  const rows = await db.select().from(weeks).where(inArray(weeks.status, currentWeekStatuses));
  const current = resolveCurrentWeekFromCandidates(rows.map(candidateFromRow), now);
  if (!current) throw new ArenaDomainError("WEEK_NOT_FOUND", "No current Arena week is available.");
  const week = rows.find((row) => row.id === current.id);
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "No current Arena week is available.");
  return week;
}

function toEnrollment(row: typeof enrollments.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    weekId: row.weekId,
    projectId: row.projectId,
    status: row.status,
    selectedAt: row.selectedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function existingEnrollmentForWeek(userId: string, weekId: string) {
  return (await getDb().select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.weekId, weekId))))[0];
}

export async function selectArenaProject({ userId, projectId, now = new Date() }: { userId: string; projectId: string; now?: Date }) {
  const parsed = projectSelectionSchema.safeParse({ projectId });
  if (!parsed.success) throw new ArenaDomainError("VALIDATION_ERROR", "Invalid project selection request.");
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const week = await findCurrentWeek(tx, now);
      const selection = getWeekSelectionState(candidateFromRow(week), now);
      if (!selection.canSelect) throw new ArenaDomainError(selection.reason ?? "WEEK_NOT_OPEN", "Project selection is not open.");

      const rules = (await tx.select().from(weekRules).where(eq(weekRules.weekId, week.id)))[0];
      if (!rules || rules.maxProjectsPerUser < 1) throw new ArenaDomainError("WEEK_NOT_OPEN", "Project selection is unavailable for this week.");

      const project = (await tx.select({ project: projects, division: divisions }).from(projects)
        .innerJoin(divisions, eq(projects.divisionId, divisions.id))
        .where(eq(projects.id, parsed.data.projectId)))[0];
      if (!project) throw new ArenaDomainError("PROJECT_NOT_FOUND", "Project not found.");
      if (project.project.status !== "PUBLISHED" || !project.division.isActive) throw new ArenaDomainError("PROJECT_NOT_PUBLISHED", "Project is not available for selection.");
      if (project.project.weekId !== week.id) throw new ArenaDomainError("PROJECT_NOT_IN_ACTIVE_WEEK", "Project is not part of the active week.");

      const existing = (await tx.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.weekId, week.id))))[0];
      if (existing) {
        if (existing.projectId === project.project.id) return { enrollment: toEnrollment(existing), created: false };
        throw new ArenaDomainError("ALREADY_ENROLLED_THIS_WEEK", "A project is already selected for this week.", { enrollmentId: existing.id });
      }

      const enrollment = (await tx.insert(enrollments).values({ userId, weekId: week.id, projectId: project.project.id }).returning())[0];
      return { enrollment: toEnrollment(enrollment), created: true };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const week = await findCurrentWeek(db, now);
    const existing = await existingEnrollmentForWeek(userId, week.id);
    if (existing?.projectId === parsed.data.projectId) return { enrollment: toEnrollment(existing), created: false };
    if (existing) throw new ArenaDomainError("ALREADY_ENROLLED_THIS_WEEK", "A project is already selected for this week.", { enrollmentId: existing.id });
    throw error;
  }
}

export async function getCurrentArenaEnrollment({ userId, now = new Date() }: { userId: string; now?: Date }) {
  const week = await findCurrentWeek(getDb(), now);
  const enrollment = await existingEnrollmentForWeek(userId, week.id);
  return enrollment ? toEnrollment(enrollment) : null;
}

export async function getArenaEnrollment({ userId, enrollmentId }: { userId: string; enrollmentId: string }) {
  const enrollment = (await getDb().select().from(enrollments)
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, userId))))[0];
  if (!enrollment) throw new ArenaDomainError("ENROLLMENT_NOT_FOUND", "Enrollment not found.");
  return toEnrollment(enrollment);
}
