import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { completeReviewJob } from "@/server/reviews/queue-service";
import { reviewerOutputSchema } from "@/server/reviews/review-schema";

export const dynamic = "force-dynamic";

const completeSchema = z.object({
  jobId: z.string().uuid(),
  workerId: z.string().trim().min(1).max(100),
  output: reviewerOutputSchema,
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
    const completed = await completeReviewJob({
      jobId: parsed.data.jobId,
      workerId: parsed.data.workerId,
      output: parsed.data.output,
    });
    return arenaData({ completed });
  } catch (error) {
    return arenaError(error);
  }
}
