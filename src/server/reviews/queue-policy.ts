/**
 * Lease arithmetic for the review queue, kept free of the database so the
 * rules can be read — and tested — on their own.
 *
 * The queue has exactly one safety property: at any moment, at most one worker
 * may settle a job, and only the worker that currently holds a live lease on
 * the attempt it was given. Everything below is that sentence made checkable.
 */

/** Automation retry budget per job (PRD §42, §47). Separate from user review attempts. */
export const MAX_JOB_ATTEMPTS = 5;
/**
 * Worker lease duration: covers model call + file fetch with margin.
 * Mirrors EXECUTION_CONTRACT.leaseSeconds; the scheduler contract test asserts
 * the two stay equal so the queue and the external worker cannot drift apart.
 */
export const JOB_LEASE_SECONDS = 600;

export type LeaseState =
  | "VALID"
  | "SETTLED"
  | "NOT_PROCESSING"
  | "WRONG_WORKER"
  | "LEASE_EXPIRED"
  | "ATTEMPT_SUPERSEDED";

export interface LeaseSubject {
  status: string;
  lockedBy: string | null;
  leaseExpiresAt: Date | null;
  attemptCount: number;
}

export function backoffAvailableAt(attemptCount: number, now: Date): Date {
  const backoffSeconds = Math.min(3600, attemptCount * attemptCount * 60);
  return new Date(now.getTime() + backoffSeconds * 1000);
}

/**
 * Why may (or may not) this caller settle this job?
 *
 * The order matters for the message the operator reads, not for the outcome:
 * a settled job is reported as settled rather than as "wrong worker", because
 * the common cause of a late callback is a worker that timed out locally while
 * its result had already landed.
 */
export function classifyLease(
  job: LeaseSubject,
  caller: { workerId: string; now: Date; attemptCount?: number },
): LeaseState {
  if (job.status === "COMPLETED" || job.status === "FAILED") return "SETTLED";
  if (job.status !== "PROCESSING") return "NOT_PROCESSING";
  if (job.lockedBy !== caller.workerId) return "WRONG_WORKER";
  if (!job.leaseExpiresAt || job.leaseExpiresAt <= caller.now) return "LEASE_EXPIRED";
  if (caller.attemptCount !== undefined && caller.attemptCount !== job.attemptCount) return "ATTEMPT_SUPERSEDED";
  return "VALID";
}

/**
 * A job nobody can rescue any more.
 *
 * `claimReviewJob` only picks up jobs below the attempt budget, so a worker
 * that dies after winning attempt five leaves PROCESSING behind with an
 * expired lease and no path back into the queue. Finalization then refuses the
 * whole week because an "open" job exists. Recognising that state is what lets
 * the sweeper end it as FAILED, which is recoverable by an admin rerun.
 */
export function isAbandonedAtAttemptLimit(job: LeaseSubject, now: Date): boolean {
  return job.status === "PROCESSING"
    && job.attemptCount >= MAX_JOB_ATTEMPTS
    && (!job.leaseExpiresAt || job.leaseExpiresAt <= now);
}

/** Can an admin safely reset this job without stealing work from a live worker? */
export function canAdminRequeue(job: LeaseSubject | null, now: Date): boolean {
  if (!job) return true;
  return classifyLease(job, { workerId: job.lockedBy ?? "", now }) !== "VALID";
}
