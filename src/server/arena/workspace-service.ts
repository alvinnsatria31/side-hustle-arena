import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { enrollments, weeks, workspaceProgress } from "../db/schema";
import { ArenaDomainError } from "./errors";
import { workspacePatchSchema, type WorkspacePatchInput } from "./schemas";
import { getWeekSelectionState, type WeekCandidate } from "./week-service";

function hasOwn(input: WorkspacePatchInput, key: keyof WorkspacePatchInput): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

async function getOwnedEnrollmentWithWeek(userId: string, enrollmentId: string) {
  const row = (await getDb().select({ enrollment: enrollments, week: weeks }).from(enrollments)
    .innerJoin(weeks, eq(enrollments.weekId, weeks.id))
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, userId))))[0];
  if (!row) throw new ArenaDomainError("ENROLLMENT_NOT_FOUND", "Enrollment not found.");
  return row;
}

function asCandidate(week: typeof weeks.$inferSelect): WeekCandidate {
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

export async function getArenaWorkspace({ userId, enrollmentId }: { userId: string; enrollmentId: string }) {
  await getOwnedEnrollmentWithWeek(userId, enrollmentId);
  return (await getDb().select().from(workspaceProgress).where(eq(workspaceProgress.enrollmentId, enrollmentId)))[0] ?? null;
}

export async function patchArenaWorkspace({ userId, enrollmentId, input, now = new Date() }: { userId: string; enrollmentId: string; input: WorkspacePatchInput; now?: Date }) {
  const parsed = workspacePatchSchema.safeParse(input);
  if (!parsed.success) throw new ArenaDomainError("VALIDATION_ERROR", "Invalid workspace request.");
  const owned = await getOwnedEnrollmentWithWeek(userId, enrollmentId);
  const state = getWeekSelectionState(asCandidate(owned.week), now);
  if (!state.canSelect) throw new ArenaDomainError(state.reason ?? "WEEK_NOT_OPEN", "Workspace editing is locked for this week.");

  const value = parsed.data;
  const changes = {
    ...(hasOwn(value, "currentStep") ? { currentStep: value.currentStep } : {}),
    ...(hasOwn(value, "planText") ? { planText: value.planText } : {}),
    ...(hasOwn(value, "tools") ? { tools: value.tools } : {}),
    ...(hasOwn(value, "taskBreakdown") ? { taskBreakdown: value.taskBreakdown } : {}),
    ...(hasOwn(value, "notes") ? { notes: value.notes } : {}),
    ...(hasOwn(value, "reviewChecklist") ? { reviewChecklist: value.reviewChecklist } : {}),
  };

  return (await getDb().insert(workspaceProgress).values({ enrollmentId, ...changes })
    .onConflictDoUpdate({ target: workspaceProgress.enrollmentId, set: { ...changes, updatedAt: new Date() } })
    .returning())[0];
}
