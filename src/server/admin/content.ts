import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { divisions, projects, projectStatus, weekRules, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";

type Db = ReturnType<typeof getDb>;

const reason = z.string().trim().min(1).max(1000);
const MUTABLE_WEEK = ["DRAFT", "PREVIEW", "SCHEDULED"] as const;

function instant(label: string, value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ArenaDomainError("VALIDATION_ERROR", `${label} is not a valid timestamp.`);
  return date;
}

/**
 * An off-schedule week.
 *
 * `prepareScheduledWeek` deliberately only fires inside the Sunday window, so
 * it cannot answer "we need a project live on Tuesday". This can: the dates
 * come from the operator instead of `weeklyWindow`, and everything downstream
 * (generation, preview, publication) keeps its own guards. The default rules
 * row is not cosmetic — project generation refuses a week without one.
 */
export const weekCreateSchema = z.object({
  weekCode: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Week code may use letters, digits, dot, colon, dash and underscore."),
  title: z.string().trim().min(1).max(200),
  opensAt: z.string().min(1),
  submissionDeadlineAt: z.string().min(1),
  previewAt: z.string().min(1).nullish(),
});

export async function createAdminWeek(input: z.infer<typeof weekCreateSchema> & { actorSubject: string; db?: Db }) {
  const opensAt = instant("opensAt", input.opensAt);
  const submissionDeadlineAt = instant("submissionDeadlineAt", input.submissionDeadlineAt);
  const previewAt = input.previewAt ? instant("previewAt", input.previewAt) : null;
  if (submissionDeadlineAt <= opensAt) throw new ArenaDomainError("VALIDATION_ERROR", "Deadline must be after the opening time.");
  if (previewAt && previewAt > opensAt) throw new ArenaDomainError("VALIDATION_ERROR", "Preview time cannot be after the opening time.");

  return (input.db ?? getDb()).transaction(async (tx) => {
    const [clash] = await tx.select({ id: weeks.id }).from(weeks).where(eq(weeks.weekCode, input.weekCode)).limit(1);
    if (clash) throw new ArenaDomainError("VALIDATION_ERROR", "A week with this code already exists.");
    const [week] = await tx.insert(weeks).values({ weekCode: input.weekCode, title: input.title, status: "DRAFT", opensAt, submissionDeadlineAt, previewAt }).returning();
    await tx.insert(weekRules).values({ weekId: week.id });
    await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "WEEK_CREATED", entityType: "week", entityId: week.id,
      metadata: { weekCode: week.weekCode, opensAt: opensAt.toISOString(), submissionDeadlineAt: submissionDeadlineAt.toISOString() } });
    return week;
  });
}

export const weekRescheduleSchema = z.object({
  weekId: z.string().uuid(),
  opensAt: z.string().min(1).optional(),
  submissionDeadlineAt: z.string().min(1).optional(),
  previewAt: z.string().min(1).nullish(),
  reason,
});

/**
 * Move a week in time.
 *
 * An OPEN week keeps its opening instant — participants have already seen it,
 * and rewriting it would retroactively change who was late. Its deadline can
 * still move, which is the extension operators actually ask for. Anything past
 * OPEN is history and is refused outright.
 */
export async function rescheduleAdminWeek(input: z.infer<typeof weekRescheduleSchema> & { actorSubject: string; db?: Db }) {
  return (input.db ?? getDb()).transaction(async (tx) => {
    const [week] = await tx.select().from(weeks).where(eq(weeks.id, input.weekId)).for("update");
    if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Week not found.");
    if (![...MUTABLE_WEEK, "OPEN"].includes(week.status)) throw new ArenaDomainError("WEEK_NOT_READY", "Only a week that has not been closed can be rescheduled.");

    if (week.status === "OPEN" && input.opensAt) throw new ArenaDomainError("VALIDATION_ERROR", "An open week cannot change its opening time.");
    const opensAt = input.opensAt ? instant("opensAt", input.opensAt) : week.opensAt;
    const submissionDeadlineAt = input.submissionDeadlineAt ? instant("submissionDeadlineAt", input.submissionDeadlineAt) : week.submissionDeadlineAt;
    const previewAt = input.previewAt === undefined ? week.previewAt : input.previewAt === null ? null : instant("previewAt", input.previewAt);
    if (submissionDeadlineAt <= opensAt) throw new ArenaDomainError("VALIDATION_ERROR", "Deadline must be after the opening time.");
    if (previewAt && previewAt > opensAt) throw new ArenaDomainError("VALIDATION_ERROR", "Preview time cannot be after the opening time.");

    await tx.update(weeks).set({ opensAt, submissionDeadlineAt, previewAt, updatedAt: new Date() }).where(eq(weeks.id, week.id));
    await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "WEEK_RESCHEDULED", entityType: "week", entityId: week.id,
      metadata: { reason: input.reason, from: { opensAt: week.opensAt, submissionDeadlineAt: week.submissionDeadlineAt },
        to: { opensAt, submissionDeadlineAt } } });
    return { weekId: week.id, opensAt, submissionDeadlineAt, previewAt };
  });
}

export const divisionSchema = z.object({
  slug: z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words separated by single dashes."),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export async function listAdminDivisions(db: Db = getDb()) {
  return db.select().from(divisions).orderBy(asc(divisions.sortOrder), asc(divisions.name));
}

export async function createAdminDivision(input: z.infer<typeof divisionSchema> & { actorSubject: string; db?: Db }) {
  return (input.db ?? getDb()).transaction(async (tx) => {
    const [clash] = await tx.select({ id: divisions.id }).from(divisions).where(eq(divisions.slug, input.slug)).limit(1);
    if (clash) throw new ArenaDomainError("VALIDATION_ERROR", "A division with this slug already exists.");
    const [division] = await tx.insert(divisions).values({ slug: input.slug, name: input.name,
      description: input.description ?? null, isActive: input.isActive, sortOrder: input.sortOrder }).returning();
    await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "DIVISION_CREATED", entityType: "division", entityId: division.id, metadata: { slug: division.slug } });
    return division;
  });
}

/**
 * The slug stays immutable: it is the public identifier seeds and links
 * already point at, so renaming it would break those rather than rename them.
 */
export const divisionUpdateSchema = divisionSchema.omit({ slug: true }).partial().extend({ divisionId: z.string().uuid() });

export async function updateAdminDivision(input: z.infer<typeof divisionUpdateSchema> & { actorSubject: string; db?: Db }) {
  const patch = Object.fromEntries((["name", "description", "isActive", "sortOrder"] as const)
    .filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
  if (!Object.keys(patch).length) throw new ArenaDomainError("VALIDATION_ERROR", "No changes were supplied.");
  return (input.db ?? getDb()).transaction(async (tx) => {
    const [division] = await tx.select().from(divisions).where(eq(divisions.id, input.divisionId)).for("update");
    if (!division) throw new ArenaDomainError("VALIDATION_ERROR", "Division not found.");
    await tx.update(divisions).set({ ...patch, updatedAt: new Date() }).where(eq(divisions.id, input.divisionId));
    await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "DIVISION_UPDATED", entityType: "division", entityId: input.divisionId, metadata: { changes: patch } });
    return { divisionId: input.divisionId, ...patch };
  });
}

export const projectListQuery = z.object({
  weekId: z.string().uuid().optional(),
  divisionId: z.string().uuid().optional(),
  // Mirrors arena.project_status; a value outside it is a client bug, not a filter.
  status: z.enum(projectStatus.enumValues).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});

export async function listAdminProjects(query: z.infer<typeof projectListQuery>, db: Db = getDb()) {
  return db.select({ id: projects.id, title: projects.title, slug: projects.slug, status: projects.status,
    previewStatus: projects.previewStatus, difficulty: projects.difficulty, estimatedMinutes: projects.estimatedMinutes,
    scheduledPublishAt: projects.scheduledPublishAt, publishedAt: projects.publishedAt, updatedAt: projects.updatedAt,
    weekId: weeks.id, weekCode: weeks.weekCode, weekStatus: weeks.status, weekOpensAt: weeks.opensAt,
    divisionId: divisions.id, divisionName: divisions.name })
    .from(projects).innerJoin(weeks, eq(weeks.id, projects.weekId)).innerJoin(divisions, eq(divisions.id, projects.divisionId))
    .where(and(query.weekId ? eq(projects.weekId, query.weekId) : undefined,
      query.divisionId ? eq(projects.divisionId, query.divisionId) : undefined,
      query.status ? eq(projects.status, query.status) : undefined))
    .orderBy(desc(weeks.opensAt), asc(divisions.sortOrder), projects.id).limit(query.limit).offset(query.offset);
}

export const projectScheduleSchema = z.object({
  projectId: z.string().uuid(),
  scheduledPublishAt: z.string().min(1).nullable(),
  reason,
});

/**
 * `scheduled_publish_at` is not part of the validated package, so moving it
 * cannot invalidate the content hash — it is the one project column the
 * console may write directly. Everything else goes through `reviewProject`.
 */
export async function setAdminProjectSchedule(input: z.infer<typeof projectScheduleSchema> & { actorSubject: string; db?: Db }) {
  const scheduledPublishAt = input.scheduledPublishAt === null ? null : instant("scheduledPublishAt", input.scheduledPublishAt);
  return (input.db ?? getDb()).transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, input.projectId)).for("update");
    if (!project) throw new ArenaDomainError("PROJECT_NOT_FOUND", "Project not found.");
    if (["PUBLISHED", "ARCHIVED"].includes(project.status)) throw new ArenaDomainError("WEEK_NOT_READY", "Published or superseded content is immutable.");
    const [week] = await tx.select().from(weeks).where(eq(weeks.id, project.weekId));
    if (!week || !MUTABLE_WEEK.includes(week.status as (typeof MUTABLE_WEEK)[number])) throw new ArenaDomainError("WEEK_NOT_READY", "The week no longer accepts project changes.");
    if (scheduledPublishAt && scheduledPublishAt >= week.submissionDeadlineAt) throw new ArenaDomainError("VALIDATION_ERROR", "Publication must be scheduled before the submission deadline.");

    await tx.update(projects).set({ scheduledPublishAt, updatedAt: new Date() }).where(eq(projects.id, project.id));
    await writeAudit(tx, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "PROJECT_SCHEDULE_SET", entityType: "project", entityId: project.id,
      metadata: { reason: input.reason, from: project.scheduledPublishAt, to: scheduledPublishAt } });
    return { projectId: project.id, scheduledPublishAt };
  });
}
