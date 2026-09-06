import "server-only";
import { desc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { runs } from "@/server/db/schema";
import { writeAudit } from "@/server/reviews/audit";
import { JOBS, type JobName } from "@/server/scheduler/service";
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
} satisfies Record<JobName, { scope: ArenaAdminScope; label: string; detail: string }>;

export type AdminJobName = JobName;

export function isAdminJob(value: string): value is JobName {
  return Object.hasOwn(adminJobs, value);
}

export function adminJobCatalogue() {
  return (Object.keys(adminJobs) as JobName[]).map((job) => ({ job, ...adminJobs[job] }));
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
