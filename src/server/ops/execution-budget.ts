/**
 * One place that says how long anything is allowed to take.
 *
 * Before this existed the numbers disagreed with each other: the cron route
 * declared 60s, the internal review route declared 300s for identical work, the
 * drain tick allowed 45s but only started counting after extraction had already
 * run, OCR gave itself 60s per image with no idea what it was inside of, and
 * the n8n grading workflow used a 30s claim timeout chosen independently. A
 * request could therefore be killed by the platform while every individual
 * component believed it was well within its own limit.
 *
 * The contract below is deliberately conservative and additive: every stage
 * budget is a slice of the invocation budget, and the sum of the stages a
 * single job can reach is less than the drain budget. Nothing here is a
 * promise about how fast a provider is — it is a promise about when we stop
 * waiting, so that a slow provider produces a retry rather than a killed
 * invocation with a job leased to a worker that no longer exists.
 */

export const EXECUTION_CONTRACT = {
  /** Route `maxDuration` for scheduled and worker-triggered endpoints, in seconds. */
  invocationSeconds: 60,
  /** Work budget inside one invocation, leaving room to serialise a response. */
  drainBudgetMs: 45_000,
  /** Claim + artifact download + document extraction + OCR, for the whole job. */
  extractionBudgetMs: 15_000,
  /** A single model call: primary review, second judge, or one generation attempt. */
  modelBudgetMs: 12_000,
  /** Validation, scoring and the database writes that settle a job. */
  persistenceReserveMs: 3_000,
  /** One division of weekly generation, including its retries. */
  divisionBudgetMs: 20_000,
  /** Outbox drain (email flush, week broadcasts) inside one invocation. */
  outboxBudgetMs: 30_000,

  /*
   * The external grading worker (n8n on the VPS) is not serverless, so its
   * model call may exceed the invocation budget — but its numbers still have
   * to agree with Arena's, because both sides share one lease.
   */
  /** Worker-side model call ceiling. */
  workerModelTimeoutMs: 300_000,
  /** How long the worker waits on an Arena endpoint: the server ceiling plus margin. */
  workerHttpTimeoutMs: 90_000,
  /** Review job lease, in seconds. Must outlast a worker's whole round trip. */
  leaseSeconds: 600,
} as const;

/**
 * The invariant tying the two sides together: a worker must never still be
 * working on a job whose lease has already expired, because a second worker
 * would then legitimately claim it and two reviews would race.
 */
export function workerRoundTripFitsLease(): boolean {
  return EXECUTION_CONTRACT.workerModelTimeoutMs + EXECUTION_CONTRACT.workerHttpTimeoutMs * 2
    < EXECUTION_CONTRACT.leaseSeconds * 1_000;
}

/**
 * End-to-end cost of one review, worst case: extraction, primary model,
 * second judge, and the writes. A drain tick refuses to claim a job it cannot
 * finish, because a claim it abandons costs an automation attempt for nothing.
 */
export function reviewJobBudgetMs(): number {
  return EXECUTION_CONTRACT.extractionBudgetMs
    + EXECUTION_CONTRACT.modelBudgetMs * 2
    + EXECUTION_CONTRACT.persistenceReserveMs;
}

export interface ExecutionBudget {
  /** Milliseconds left, never negative. */
  remainingMs(): number;
  expired(): boolean;
  /** Is there room for a stage of this size, plus the reserve to settle afterwards? */
  hasRoomFor(costMs: number, reserveMs?: number): boolean;
  /**
   * An AbortSignal that fires no later than the deadline, optionally capped to
   * a smaller per-stage ceiling. Whichever expires first wins.
   */
  signal(capMs?: number): AbortSignal;
  /** Throw before starting work there is demonstrably no time for. */
  assertRoomFor(costMs: number, stage: string, reserveMs?: number): void;
}

export class BudgetExceededError extends Error {
  readonly stage: string;
  constructor(stage: string, remainingMs: number, requiredMs: number) {
    super(`Not enough execution budget for ${stage}: ${remainingMs}ms left, ${requiredMs}ms required.`);
    this.name = "BudgetExceededError";
    this.stage = stage;
  }
}

/**
 * `now` is injectable so the arithmetic can be tested without waiting; the
 * signal still uses real timers, because that is what callers actually need.
 */
export function createExecutionBudget(
  totalMs: number,
  options: { now?: () => number; parent?: AbortSignal } = {},
): ExecutionBudget {
  const now = options.now ?? Date.now;
  const deadline = now() + Math.max(0, totalMs);
  const remainingMs = () => Math.max(0, deadline - now());
  return {
    remainingMs,
    expired: () => remainingMs() <= 0,
    hasRoomFor(costMs, reserveMs = 0) {
      return remainingMs() >= costMs + reserveMs;
    },
    signal(capMs) {
      const budgetSignal = AbortSignal.timeout(Math.max(1, capMs === undefined ? remainingMs() : Math.min(capMs, remainingMs())));
      return options.parent ? AbortSignal.any([options.parent, budgetSignal]) : budgetSignal;
    },
    assertRoomFor(costMs, stage, reserveMs = 0) {
      if (!this.hasRoomFor(costMs, reserveMs)) {
        throw new BudgetExceededError(stage, remainingMs(), costMs + reserveMs);
      }
    },
  };
}

/**
 * Did this throw because a deadline cut it short?
 *
 * `AbortSignal.timeout` rejects with a `TimeoutError` DOMException and an
 * explicit abort with `AbortError`; undici surfaces both through fetch. Node
 * builds without a global `DOMException` still name their errors the same way,
 * so the name is what is matched rather than the class.
 */
export function isDeadlineError(error: unknown): boolean {
  if (error instanceof BudgetExceededError) return true;
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
