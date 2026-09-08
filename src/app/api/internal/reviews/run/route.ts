import { arenaData, arenaError } from '@/server/arena';
import { requireAutomationWorker } from '@/server/reviews/internal-auth';
import { runConfiguredReviewJob } from '@/server/reviews/worker';

export const dynamic = 'force-dynamic';
/**
 * Same ceiling as the cron entrypoint. These two routes run identical work and
 * used to declare 300 and 60 — so whether a review was allowed five minutes or
 * one depended on who triggered it, and the budget inside could not be right
 * for both. See EXECUTION_CONTRACT.invocationSeconds; the scheduler contract
 * test asserts this literal still matches it.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    requireAutomationWorker(request);
    return arenaData({ completed: await runConfiguredReviewJob() });
  } catch (error) { return arenaError(error); }
}
