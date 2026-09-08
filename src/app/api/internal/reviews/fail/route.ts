import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { failReviewJob } from "@/server/reviews/queue-service";

export const dynamic = "force-dynamic";

const failSchema = z.object({
  jobId: z.string().uuid(),
  workerId: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(500),
});

/**
 * Worker-reported failure: retries with backoff, never consumes a user attempt
 * (PRD §42).
 *
 * A callback that arrives after the job was completed or re-leased answers 200
 * with `applied: false`. It is not an error the worker can do anything about,
 * and returning 409 would make well-behaved workers retry a report that must
 * never be obeyed.
 */
export async function POST(request: Request) {
  try {
    requireAutomationWorker(request);
    const parsed = failSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return arenaData({ recorded: false, reason: "VALIDATION_ERROR" }, 400);
    }
    const result = await failReviewJob(parsed.data);
    return arenaData({ recorded: result });
  } catch (error) {
    return arenaError(error);
  }
}
