import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { completeReviewJob } from "@/server/reviews/queue-service";
import { reviewerOutputSchema } from "@/server/reviews/review-schema";
import { EXECUTION_CONTRACT, createExecutionBudget } from "@/server/ops/execution-budget";

export const dynamic = "force-dynamic";
/** See EXECUTION_CONTRACT.invocationSeconds — one ceiling for every review path. */
export const maxDuration = 60;

const completeSchema = z.object({
  jobId: z.string().uuid(),
  workerId: z.string().trim().min(1).max(100),
  output: reviewerOutputSchema,
  /**
   * Which model produced this output. Without it every externally-graded review
   * was stored as the literal string "external-worker", so provenance for the
   * n8n path told you nothing about what actually did the grading.
   */
  model: z.string().trim().min(1).max(200).optional(),
});

/**
 * Hermes delivers the primary reviewer output. The server validates,
 * optionally runs the independent second judge, computes the weighted score,
 * and persists — workers never write scores directly (PRD §20).
 */
export async function POST(request: Request) {
  try {
    requireAutomationWorker(request);
    const parsed = completeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return arenaData({ completed: false, reason: "VALIDATION_ERROR" }, 400);
    }
    // The second judge runs here, inside this request. Give it a budget so a
    // slow judge hands the job back for retry instead of being killed mid-write.
    const completed = await completeReviewJob({
      jobId: parsed.data.jobId,
      workerId: parsed.data.workerId,
      output: parsed.data.output,
      model: parsed.data.model,
      budget: createExecutionBudget(EXECUTION_CONTRACT.drainBudgetMs),
    });
    return arenaData({ completed });
  } catch (error) {
    return arenaError(error);
  }
}
