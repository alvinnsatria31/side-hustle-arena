import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { deliveries, jobSources, logs, reviewJobs, runs } from "@/server/db/schema";
import { EMAIL_RETRY_WINDOW_MS, MAX_EMAIL_ATTEMPTS } from "@/server/notifications/outbox-policy";
import { JOB_LEASE_SECONDS, MAX_JOB_ATTEMPTS } from "@/server/reviews/queue-policy";
import { getSpendWindow } from "@/server/cv/rate-limit";
import { sourceHealth } from "@/server/career/jobs/sync-core";

type Db = ReturnType<typeof getDb>;

/**
 * Is the automation actually working right now?
 *
 * The console already showed queue depth, which answers "how much is queued"
 * and not "is anything wrong". Those differ in the cases that matter: a queue
 * of zero is healthy when everything drained and alarming when nothing has run
 * for a day, and a queue of five is fine unless all five have been leased to a
 * worker that died.
 *
 * So this reports STATES an operator can act on, each with the fact that
 * produced it. Every number here is derived from rows the system already
 * writes — there is no separate metrics pipeline to fall out of sync, and
 * nothing is estimated.
 */

export type AlertLevel = "OK" | "WARN" | "ALERT";

export interface HealthSignal {
  key: string;
  level: AlertLevel;
  /** What the operator should read. Names the number, not just the state. */
  detail: string;
  /** What to do about it, when there is something to do. */
  action?: string;
}

/**
 * How long a claimable review job may wait before the *absence* of a worker is
 * the story, rather than the depth of the queue.
 *
 * The grading workflow polls every 2 minutes, so a job still unclaimed well past
 * that means nothing is polling at all: the n8n workflow is inactive, its
 * credentials are wrong, or the box is unreachable. This is the one failure the
 * existing counters cannot show — `review-stranded` and `review-lease-expired`
 * both read PROCESSING, and a queue nobody ever claims never reaches PROCESSING.
 * It stays silent on a healthy empty queue, which is why it keys off the age of
 * the oldest claimable job and not off depth.
 */
const REVIEW_UNCLAIMED_WARN_MINUTES = 30;
const REVIEW_UNCLAIMED_ALERT_MINUTES = 120;

/** A scheduled job that has not run for far longer than its own cadence. */
const HEARTBEAT_EXPECTATIONS: Array<{ job: string; action: string; withinHours: number }> = [
  { job: "jobs-sync", withinHours: 24, action: "Cek /app/admin/careers dan pemicu n8n “Every 4 hours”." },
  { job: "email-flush", withinHours: 6, action: "Cek pemicu n8n “Every 15 minutes”; retry email kedaluwarsa setelah 23 jam." },
  { job: "week-notifications", withinHours: 48, action: "Cek pemicu n8n harian." },
  { job: "storage-cleanup", withinHours: 48, action: "Cek pemicu n8n harian." },
];

export async function getAutomationHealth(db: Db = getDb(), now = new Date()) {
  const signals: HealthSignal[] = [];

  // --- review queue -------------------------------------------------------
  const queueRows = await db
    .select({ status: reviewJobs.status, count: sql<number>`count(*)::int` })
    .from(reviewJobs)
    .groupBy(reviewJobs.status);
  const queue = Object.fromEntries(queueRows.map((row) => [row.status, row.count]));

  const [stranded] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewJobs)
    .where(and(
      eq(reviewJobs.status, "PROCESSING"),
      gte(reviewJobs.attemptCount, MAX_JOB_ATTEMPTS),
      lte(reviewJobs.leaseExpiresAt, now),
    ));
  if ((stranded?.count ?? 0) > 0) {
    signals.push({
      key: "review-stranded",
      level: "ALERT",
      detail: `${stranded.count} review job tertahan PROCESSING dengan lease mati pada percobaan terakhir.`,
      action: "Jalankan job “Jalankan review” — claim menyapu job ini menjadi FAILED, lalu rerun dari halaman Review.",
    });
  }

  const [expiredLease] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewJobs)
    .where(and(eq(reviewJobs.status, "PROCESSING"), lte(reviewJobs.leaseExpiresAt, now)));
  if ((expiredLease?.count ?? 0) > (stranded?.count ?? 0)) {
    signals.push({
      key: "review-lease-expired",
      level: "WARN",
      detail: `${expiredLease.count - (stranded?.count ?? 0)} review job punya lease kedaluwarsa dan menunggu diklaim ulang.`,
      action: `Lease berlaku ${JOB_LEASE_SECONDS} detik; kalau angkanya tidak turun, worker grading kemungkinan mati.`,
    });
  }

  const [claimable] = await db
    .select({
      count: sql<number>`count(*)::int`,
      oldestAvailableAt: sql<Date | null>`min(${reviewJobs.availableAt})`,
    })
    .from(reviewJobs)
    .where(and(
      inArray(reviewJobs.status, ["PENDING", "RETRY"]),
      lte(reviewJobs.availableAt, now),
    ));
  const oldestClaimableAt = claimable?.oldestAvailableAt ? new Date(claimable.oldestAvailableAt) : null;
  const claimableWaitedMinutes = oldestClaimableAt
    ? Math.floor((now.getTime() - oldestClaimableAt.getTime()) / 60_000)
    : null;
  if (claimableWaitedMinutes !== null && claimableWaitedMinutes >= REVIEW_UNCLAIMED_WARN_MINUTES) {
    signals.push({
      key: "review-unclaimed",
      level: claimableWaitedMinutes >= REVIEW_UNCLAIMED_ALERT_MINUTES ? "ALERT" : "WARN",
      detail: `${claimable.count} review job siap diklaim, yang tertua sudah menunggu ${claimableWaitedMinutes} menit tanpa ada worker yang mengambilnya.`,
      action: "Worker grading tidak berjalan. Cek workflow n8n “Arena grading (claim/lease)” aktif dan INTERNAL_AUTOMATION_TOKEN, AI_API_BASE_URL, AI_API_KEY, AI_REVIEW_MODEL terisi di container.",
    });
  }

  // --- email outbox -------------------------------------------------------
  const [emailBacklog] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deliveries)
    .where(and(eq(deliveries.channel, "EMAIL"), inArray(deliveries.status, ["PENDING", "FAILED"])));
  const [emailHeld] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deliveries)
    .where(and(eq(deliveries.channel, "EMAIL"), eq(deliveries.status, "FAILED"), gte(deliveries.attemptCount, MAX_EMAIL_ATTEMPTS)));
  const [emailAging] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deliveries)
    .where(and(
      eq(deliveries.channel, "EMAIL"),
      inArray(deliveries.status, ["PENDING", "FAILED"]),
      isNotNull(deliveries.firstAttemptAt),
      lte(deliveries.firstAttemptAt, new Date(now.getTime() - EMAIL_RETRY_WINDOW_MS / 2)),
    ));
  if ((emailAging?.count ?? 0) > 0) {
    signals.push({
      key: "email-aging",
      level: "ALERT",
      detail: `${emailAging.count} email sudah melewati separuh jendela idempotency ${Math.round(EMAIL_RETRY_WINDOW_MS / 3600_000)} jam tanpa terkirim.`,
      action: "Jalankan “Kirim antrean email” sekarang; setelah jendela habis pesan ditahan dan butuh tindakan manual.",
    });
  }

  // --- jobs sources -------------------------------------------------------
  // Read defensively. This table arrived with the Jobs pipeline, and a database
  // that has not run that migration yet throws here — which used to take the
  // whole console down with it, including the pages an operator would use to
  // diagnose the very drift causing it. A console that cannot be opened during
  // an incident is worse than one panel reporting itself unavailable.
  let sources: Array<typeof jobSources.$inferSelect> = [];
  let sourcesReadable = true;
  try {
    sources = await db.select().from(jobSources);
  } catch {
    sourcesReadable = false;
    signals.push({
      key: "jobs-sources-unreadable",
      level: "ALERT",
      detail: "Tabel sumber lowongan tidak bisa dibaca — biasanya berarti migrasi database produksi tertinggal dari kode.",
      action: "Jalankan `npm run db:migrate` terhadap DATABASE_URL produksi, lalu muat ulang halaman ini.",
    });
  }
  for (const source of sources.filter((row) => row.isActive)) {
    const health = sourceHealth(source, now);
    if (health === "HEALTHY") continue;
    signals.push({
      key: `jobs-source:${source.slug}`,
      level: health === "FAILING" ? "ALERT" : "WARN",
      detail: `Sumber lowongan “${source.name}” berstatus ${health}${source.lastErrorCode ? ` (${source.lastErrorCode})` : ""}.`,
      action: "Buka /app/admin/careers untuk melihat error terakhir dan memicu sync manual.",
    });
  }

  // --- heartbeats ---------------------------------------------------------
  const heartbeats = [];
  for (const expectation of HEARTBEAT_EXPECTATIONS) {
    const [last] = await db
      .select({ createdAt: logs.createdAt })
      .from(logs)
      .where(and(eq(logs.entityType, "scheduled_job"), eq(logs.entityId, expectation.job)))
      .orderBy(desc(logs.createdAt))
      .limit(1);
    const ageHours = last ? (now.getTime() - last.createdAt.getTime()) / 3600_000 : null;
    const overdue = ageHours === null || ageHours > expectation.withinHours;
    heartbeats.push({ job: expectation.job, lastRunAt: last?.createdAt ?? null, expectedWithinHours: expectation.withinHours, overdue });
    if (overdue) {
      signals.push({
        key: `heartbeat:${expectation.job}`,
        level: ageHours === null ? "WARN" : "ALERT",
        detail: ageHours === null
          ? `Job “${expectation.job}” belum pernah tercatat berjalan di environment ini.`
          : `Job “${expectation.job}” terakhir berjalan ${Math.round(ageHours)} jam lalu; targetnya setiap ${expectation.withinHours} jam.`,
        action: expectation.action,
      });
    }
  }

  // --- automation runs ----------------------------------------------------
  const recentRuns = await db
    .select({ type: runs.type, status: runs.status, startedAt: runs.startedAt, errorSummary: runs.errorSummary })
    .from(runs)
    .orderBy(desc(runs.startedAt))
    .limit(10);

  // --- AI spend -----------------------------------------------------------
  const spend = await getSpendWindow(now.getTime(), db);
  if (spend.available && spend.used !== null && spend.used > spend.ceiling * 0.8) {
    signals.push({
      key: "cv-spend",
      level: spend.used >= spend.ceiling ? "ALERT" : "WARN",
      detail: `Pemindaian CV jam ini ${spend.used} dari batas ${spend.ceiling}.`,
      action: "Turunkan CV_SCAN_HOURLY_CAP atau tutup fitur lewat Saklar Darurat kalau ini lonjakan tidak wajar.",
    });
  }

  const level: AlertLevel = signals.some((signal) => signal.level === "ALERT")
    ? "ALERT"
    : signals.some((signal) => signal.level === "WARN") ? "WARN" : "OK";

  return {
    level,
    signals,
    queue,
    heartbeats,
    claimable: {
      count: claimable?.count ?? 0,
      oldestAvailableAt: oldestClaimableAt,
      waitedMinutes: claimableWaitedMinutes,
    },
    email: {
      backlog: emailBacklog?.count ?? 0,
      held: emailHeld?.count ?? 0,
      agingPastHalfWindow: emailAging?.count ?? 0,
    },
    jobsSourcesReadable: sourcesReadable,
    jobsSources: sources.map((source) => ({
      slug: source.slug,
      name: source.name,
      isActive: source.isActive,
      health: sourceHealth(source, now),
      lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
      consecutiveFailures: source.consecutiveFailures,
    })),
    cvSpend: spend,
    recentRuns,
    checkedAt: now,
  };
}

export type AutomationHealth = Awaited<ReturnType<typeof getAutomationHealth>>;

/**
 * Turn health signals into rail badges.
 *
 * The rail shows a number only where something needs doing, so this maps the
 * signals that already exist onto the page that fixes each one. Deriving it
 * from `signals` rather than from raw counts is what keeps the badges
 * action-only: a signal is by definition something an operator can act on, so
 * a queue of five healthy jobs produces no badge while one stranded job does.
 *
 * A new signal therefore lights up its page automatically — the only thing
 * needed is a prefix here. Signals with no page fall through to Overview,
 * which counts every signal regardless.
 */
const SIGNAL_ROUTES: Array<{ prefix: string; href: string }> = [
  { prefix: "review-", href: "/app/admin/reviews" },
  { prefix: "email-", href: "/app/admin/email" },
  { prefix: "heartbeat:", href: "/app/admin/jobs" },
  { prefix: "jobs-source:", href: "/app/admin/careers" },
  { prefix: "cv-", href: "/app/admin/cv-scanner" },
];

export interface NavBadge {
  count: number;
  level: Exclude<AlertLevel, "OK">;
  /** Read out by screen readers, so the badge never depends on colour alone. */
  label: string;
}

export function getAdminNavBadges(health: Pick<AutomationHealth, "signals">): Record<string, NavBadge> {
  const badges: Record<string, NavBadge> = {};
  const add = (href: string, level: AlertLevel) => {
    if (level === "OK") return;
    const current = badges[href];
    badges[href] = {
      count: (current?.count ?? 0) + 1,
      level: current?.level === "ALERT" ? "ALERT" : level,
      label: "",
    };
  };

  for (const signal of health.signals) {
    const route = SIGNAL_ROUTES.find((entry) => signal.key.startsWith(entry.prefix));
    if (route) add(route.href, signal.level);
    add("/app/admin", signal.level);
  }

  for (const [href, badge] of Object.entries(badges)) {
    badges[href] = {
      ...badge,
      label: `${badge.count} ${badge.level === "ALERT" ? "perlu tindakan" : "perlu dicek"}`,
    };
  }
  return badges;
}
