import { arenaData, arenaError } from '@/server/arena';
import { requireAutomationWorker } from '@/server/reviews/internal-auth';
import { runConfiguredReviewJob } from '@/server/reviews/worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    requireAutomationWorker(request);
    return arenaData({ completed: await runConfiguredReviewJob() });
  } catch (error) { return arenaError(error); }
}
