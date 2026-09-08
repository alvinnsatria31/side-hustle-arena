import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { jobSources, runs } from "@/server/db/schema";
import { writeAudit } from "@/server/reviews/audit";
import { JOBS, type JobName } from "@/server/scheduler/service";
import { generationConfig } from "@/server/generation/core";
import { createGenerationProvider } from "@/server/generation/ai-provider";
import { createReviewProvider } from "@/server/reviews/model-router";
import type { ArenaAdminScope } from "./auth";

type Db = ReturnType<typeof getDb>;

/**
 * The scheduled jobs, described for a human and mapped to the scope that owns
 * them.
 *
 * n8n does not decide anything: `n8n/arena-trigger-workflow.json` only calls
 * `GET /api/cron/<job>` on a timer. Running one from here takes the same code
 * path with an admin actor instead of the cron secret, which is what makes an
 * off-schedule launch possible without handing anyone the cron token.
 *
 * `satisfies Record<JobName, ...>` is the point of this table: a job added to
 * the scheduler and not given a scope here fails the build rather than
 * quietly reaching the console ungated.
 */
export const adminJobs = {
  "project-generate": { scope: "projects", label: "Generate project",
    detail: "Siapkan minggu terjadwal dan buat draft project per divisi. Aman diulang." },
  "project-drop": { scope: "projects", label: "Publikasi project",
    detail: "Publikasikan project yang sudah jatuh tempo dan buka minggunya." },
  "reviews-run": { scope: "reviews", label: "Jalankan review",
    detail: "Ambil beberapa job review dari antrean. Satu tick sengaja kecil." },
  "week-close": { scope: "weeks", label: "Tutup minggu",
    detail: "Pindahkan minggu OPEN yang deadline-nya sudah lewat ke FINALIZING." },
  "week-finalize": { scope: "weeks", label: "Finalisasi minggu",
    detail: "Hitung ranking dan bagikan poin untuk minggu yang siap." },
  "week-notifications": { scope: "notifications", label: "Notifikasi minggu",
    detail: "Kirim pengumuman terjadwal untuk minggu berjalan." },
  "email-flush": { scope: "notifications", label: "Kirim antrean email",
    detail: "Dorong email yang tertahan di outbox." },
  "session-cleanup": { scope: "users", label: "Bersihkan sesi",
    detail: "Hapus sesi peserta yang sudah kedaluwarsa." },
  "storage-cleanup": { scope: "storage", label: "Bersihkan upload",
    detail: "Hapus upload intent kedaluwarsa yang tidak dirujuk submission." },
  "jobs-sync": { scope: "careers", label: "Tarik lowongan",
    detail: "Ambil lowongan terbaru dari setiap sumber aktif yang sudah jatuh tempo. Aman diulang." },
} satisfies Record<JobName, { scope: ArenaAdminScope; label: string; detail: string }>;

export type AdminJobName = JobName;

export function isAdminJob(value: string): value is JobName {
  return Object.hasOwn(adminJobs, value);
}

/**
 * What each job would actually do right now.
 *
 * Every job here is self-gating and reports `skipped` rather than failing when
 * its switch is off — correct behaviour for a timer, and invisible to an
 * operator clicking a button and getting a shrug back. So the console reads
 * the same configuration up front and says which jobs are inert, and why,
 * before anyone runs one.
 */
export function automationReadiness(env: NodeJS.ProcessEnv = process.env) {
  let generation: ReturnType<typeof generationConfig> | null = null;
  let configError: string | null = null;
  try {
    generation = generationConfig(env);
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
  }
  const reviewProvider = (() => {
    try { return createReviewProvider("review").name; } catch { return null; }
  })();
  // Booleans only. Whether a secret is set is an operational fact the console
  // needs; its value is not, and must never reach a browser.
  const set = (key: string) => Boolean(env[key]?.trim());
  return {
    generationEnabled: generation?.enabled ?? false,
    autoPublishEnabled: generation?.autoPublish ?? false,
    previewHours: generation?.previewHours ?? null,
    generationProvider: createGenerationProvider(env)?.name ?? null,
    reviewProvider,
    configError,
    config: [
      { key: "ARENA_ADMIN_SUBJECTS", set: set("ARENA_ADMIN_SUBJECTS") || set("ARENA_ADMIN_ROLES"), purpose: "Siapa yang boleh membuka konsol ini." },
      { key: "INTERNAL_ADMIN_TOKEN", set: set("INTERNAL_ADMIN_TOKEN"), purpose: "Token n8n untuk memicu rilis di luar jadwal." },
      { key: "INTERNAL_ADMIN_SCOPES", set: set("INTERNAL_ADMIN_SCOPES"), purpose: "Harus memuat `projects` agar n8n boleh merilis." },
      { key: "CRON_SECRET", set: set("CRON_SECRET"), purpose: "Token n8n untuk job terjadwal." },
      { key: "ARENA_EVAL_TOKEN", set: set("ARENA_EVAL_TOKEN"), purpose: "Autentikasi callback penilaian dari Hermes/n8n." },
      { key: "AI_API_KEY", set: set("AI_API_KEY"), purpose: "Tanpa ini generator hanya memakai library dan review AI mati." },
      { key: "ARENA_GENERATION_ENABLED", set: generation?.enabled ?? false, purpose: "Generasi otomatis mingguan. Rilis manual tidak butuh ini." },
      { key: "ARENA_AUTO_PUBLISH_ENABLED", set: generation?.autoPublish ?? false, purpose: "Publikasi otomatis saat jadwal tiba." },
    ],
  };
}

export type AutomationReadiness = ReturnType<typeof automationReadiness> & { jobsSourcesActive?: number };

/** Why a job would do nothing if it ran right now, or null when it is live. */
function inertReason(job: JobName, readiness: AutomationReadiness): string | null {
  if (job === "project-generate" && !readiness.generationEnabled) {
    return "ARENA_GENERATION_ENABLED belum di-set, jadi job ini melaporkan “generation disabled”. Rilis manual dari panel di atas tidak terpengaruh.";
  }
  if (job === "project-drop" && !readiness.autoPublishEnabled) {
    return "ARENA_AUTO_PUBLISH_ENABLED belum di-set, jadi publikasi otomatis mati. Publikasikan manual dari halaman Minggu.";
  }
  if (job === "reviews-run" && !readiness.reviewProvider) {
    return "Provider AI review belum terkonfigurasi, jadi antrean review tidak akan jalan.";
  }
  if (job === "jobs-sync" && !readiness.jobsSourcesActive) {
    return "Belum ada sumber lowongan aktif, jadi job ini melaporkan “no active jobs source is due”. Daftarkan satu sumber di halaman Jobs.";
  }
  return null;
}

/**
 * Readiness plus the one fact that needs a database read.
 *
 * `automationReadiness` is deliberately synchronous and environment-only so it
 * can be called from anywhere; whether a jobs source exists is a row, not an
 * environment variable, so it is layered on here.
 */
export async function automationReadinessWithSources(db: Db = getDb()): Promise<AutomationReadiness & { jobsSourcesActive: number }> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(jobSources).where(eq(jobSources.isActive, true));
  return { ...automationReadiness(), jobsSourcesActive: row?.count ?? 0 };
}

export function adminJobCatalogue(readiness: AutomationReadiness = automationReadiness()) {
  return (Object.keys(adminJobs) as JobName[]).map((job) => ({ job, ...adminJobs[job], inert: inertReason(job, readiness) }));
}

/**
 * Run one job now, on the admin's authority.
 *
 * A job that reports `done: false` has not failed — it is telling the operator
 * why it could not finish (provider unconfigured, week not ready), which is
 * exactly what someone launching off-schedule needs to read. Only a thrown
 * error is a failure, and that is audited before it propagates.
 */
export async function runAdminJob(input: { job: JobName; actorSubject: string; db?: Db }) {
  const db = input.db ?? getDb();
  const startedAt = Date.now();
  try {
    const result = await JOBS[input.job]();
    const durationMs = Date.now() - startedAt;
    await writeAudit(db, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "AUTOMATION_JOB_RUN",
      entityType: "scheduled_job", entityId: input.job, metadata: { done: result.done, detail: result.detail, durationMs } });
    return { ...result, durationMs };
  } catch (error) {
    await writeAudit(db, { actorType: "ADMIN", actorSubject: input.actorSubject, action: "AUTOMATION_JOB_FAILED",
      entityType: "scheduled_job", entityId: input.job,
      metadata: { message: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startedAt } });
    throw error;
  }
}

/** Recent automation runs, so a manual trigger can be read against what the timers already did. */
export async function listAutomationRuns(limit = 20, db: Db = getDb()) {
  return db.select({ id: runs.id, type: runs.type, weekId: runs.weekId, status: runs.status,
    startedAt: runs.startedAt, completedAt: runs.completedAt, itemsTotal: runs.itemsTotal,
    itemsSuccess: runs.itemsSuccess, itemsFailed: runs.itemsFailed, errorSummary: runs.errorSummary })
    .from(runs).orderBy(desc(runs.startedAt), runs.id).limit(limit);
}
