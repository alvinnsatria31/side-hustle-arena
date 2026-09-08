import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { claimReviewJob, getReviewQueueDepth } from "@/server/reviews/queue-service";
import { EXECUTION_CONTRACT, createExecutionBudget } from "@/server/ops/execution-budget";

export const dynamic = "force-dynamic";
/** See EXECUTION_CONTRACT.invocationSeconds — one ceiling for every review path. */
export const maxDuration = 60;

const claimSchema = z.object({ workerId: z.string().trim().min(1).max(100) });

/** Hermes claims one leased job and receives the blind reviewer input. */
export async function POST(request: Request) {
  try {
    requireAutomationWorker(request);
    const parsed = claimSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return arenaData({ job: null, reason: "VALIDATION_ERROR" }, 400);
    }
    // Claiming is not free: it downloads and extracts every artifact. Bounding
    // it here is what keeps a slow OCR pass from being killed by the platform
    // with the job already leased to a worker that never got a response.
    const claimed = await claimReviewJob(parsed.data.workerId, new Date(), undefined, undefined, {
      budget: createExecutionBudget(EXECUTION_CONTRACT.drainBudgetMs),
    });
    if (!claimed) return arenaData({ job: null, reason: "QUEUE_EMPTY" });
    return arenaData({ job: claimed });
  } catch (error) {
    return arenaError(error);
  }
}

/** Queue depth for the automation health dashboard (PRD §46). */
export async function GET(request: Request) {
  try {
    requireAutomationWorker(request);
    return arenaData({ depth: await getReviewQueueDepth() });
  } catch (error) {
    return arenaError(error);
  }
}
