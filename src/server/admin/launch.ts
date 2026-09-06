import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { projects, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";
import { createGenerationProvider } from "@/server/generation/ai-provider";
import { generateWeek, publishWeek, reviewProject } from "@/server/generation/service";
import { createAdminWeek } from "./content";

type Db = ReturnType<typeof getDb>;

export const launchSchema = z.object({
  /** Reuse a week already in DRAFT/PREVIEW/SCHEDULED, or leave unset to create one. */
  weekId: z.string().uuid().optional(),
  weekCode: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  opensAt: z.string().min(1).optional(),
  submissionDeadlineAt: z.string().min(1).optional(),
  divisionId: z.string().uuid().optional(),
  /**
   * Approving generated content skips the minimum preview interval. That
   * interval exists so a human reads the AI's output before participants do —
   * so this is opt-in, and the audit trail records who chose to skip it.
   */
  approve: z.boolean().default(false),
  publish: z.boolean().default(false),
  reason: z.string().trim().min(1).max(1000),
});

export type LaunchInput = z.infer<typeof launchSchema>;

export type LaunchStep = { step: string; ok: boolean; detail: Record<string, unknown> };

/**
 * One off-schedule project release, end to end.
 *
 * The weekly cycle assumes Monday: `prepareScheduledWeek` refuses to run
 * outside the Sunday window, so "give them something on Tuesday" had no path
 * through the system at all. This composes the steps that already exist —
 * create the week, generate per division, approve, publish — into a single
 * audited operation, without loosening any of their guards.
 *
 * Every step reports rather than throws where the domain says "not yet": a
 * launch prepared for Tuesday 08:00 cannot publish on Monday, and that is the
 * correct outcome to show an operator, not an error.
 *
 * `ARENA_GENERATION_ENABLED` is deliberately not consulted. That flag governs
 * the unattended timer; a signed-in operator asking for a specific week is a
 * different act, and gating it behind the same switch would mean the console
 * could not be used to recover when the timer is off.
 */
export async function launchProjectRun(input: LaunchInput & { actorSubject: string; db?: Db }): Promise<{
  weekId: string | null;
  weekCode: string | null;
  created: boolean;
  steps: LaunchStep[];
}> {
  const db = input.db ?? getDb();
  const steps: LaunchStep[] = [];
  const now = new Date();

  // ---------------------------------------------------------------- week
  let week: typeof weeks.$inferSelect | undefined;
  let created = false;

  if (input.weekId) {
    [week] = await db.select().from(weeks).where(eq(weeks.id, input.weekId));
    if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "Week not found.");
    if (!["DRAFT", "PREVIEW", "SCHEDULED"].includes(week.status)) {
      throw new ArenaDomainError("WEEK_NOT_READY", "That week is already open or finished; create a new one for an off-schedule release.");
    }
    steps.push({ step: "week", ok: true, detail: { reused: week.weekCode, status: week.status, opensAt: week.opensAt } });
  } else {
    if (!input.opensAt || !input.submissionDeadlineAt) {
      throw new ArenaDomainError("VALIDATION_ERROR", "A new release needs both an opening time and a submission deadline.");
    }
    const opens = new Date(input.opensAt);
    const stamp = Number.isNaN(opens.getTime()) ? Date.now() : opens.getTime();
    const code = input.weekCode ?? `ADHOC-${new Date(stamp + 7 * 3_600_000).toISOString().slice(0, 10)}-${String(stamp).slice(-4)}`;
    week = await createAdminWeek({
      weekCode: code,
      title: input.title ?? `Rilis khusus ${code}`,
      opensAt: input.opensAt,
      submissionDeadlineAt: input.submissionDeadlineAt,
      previewAt: null,
      actorSubject: input.actorSubject,
      db,
    });
    created = true;
    steps.push({ step: "week", ok: true, detail: { created: week.weekCode, opensAt: week.opensAt } });
  }

  await writeAudit(db, {
    actorType: "ADMIN", actorSubject: input.actorSubject, action: "ADHOC_LAUNCH_STARTED",
    entityType: "week", entityId: week.id,
    metadata: { reason: input.reason, approve: input.approve, publish: input.publish, divisionId: input.divisionId ?? null },
  });

  // ------------------------------------------------------------ generate
  // No configured model narrows generation to the curated library rather than
  // failing: a release built from proven templates is still a release.
  const provider = createGenerationProvider() ?? undefined;
  try {
    const generated = await generateWeek({ weekId: week.id, divisionId: input.divisionId, provider, actorSubject: input.actorSubject, now });
    const failures = generated.results.filter((result) => "failed" in result);
    steps.push({
      step: "generate", ok: failures.length === 0,
      detail: { provider: provider?.name ?? "library-only", results: generated.results },
    });
  } catch (error) {
    if (!(error instanceof ArenaDomainError)) throw error;
    steps.push({ step: "generate", ok: false, detail: { failed: error.code, message: error.message } });
    return { weekId: week.id, weekCode: week.weekCode, created, steps };
  }

  // ------------------------------------------------------------- approve
  if (input.approve) {
    const pending = await db.select({ id: projects.id, title: projects.title })
      .from(projects)
      .where(and(eq(projects.weekId, week.id), eq(projects.status, "PREVIEWED"), ne(projects.previewStatus, "REJECTED")))
      .orderBy(asc(projects.createdAt));
    const approved: string[] = [];
    const refused: Array<{ projectId: string; message: string }> = [];
    for (const project of pending) {
      try {
        await reviewProject({ projectId: project.id, action: "approve", reason: input.reason, actorSubject: input.actorSubject, now });
        approved.push(project.id);
      } catch (error) {
        if (!(error instanceof ArenaDomainError)) throw error;
        refused.push({ projectId: project.id, message: error.message });
      }
    }
    steps.push({ step: "approve", ok: refused.length === 0, detail: { approved: approved.length, refused } });
  }

  // ------------------------------------------------------------- publish
  if (input.publish) {
    try {
      const result = await publishWeek({ weekId: week.id, actorSubject: input.actorSubject, now });
      steps.push({
        step: "publish",
        ok: !result.skipped && result.published.length > 0 && result.held.length === 0,
        detail: { published: result.published.length, held: result.held, ...(result.skipped ? { skipped: result.skipped } : {}) },
      });
    } catch (error) {
      if (!(error instanceof ArenaDomainError)) throw error;
      steps.push({ step: "publish", ok: false, detail: { failed: error.code, message: error.message } });
    }
  }

  await writeAudit(db, {
    actorType: "ADMIN", actorSubject: input.actorSubject, action: "ADHOC_LAUNCH_FINISHED",
    entityType: "week", entityId: week.id, metadata: { steps },
  });

  return { weekId: week.id, weekCode: week.weekCode, created, steps };
}
