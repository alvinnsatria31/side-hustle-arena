import { getCurrentUser } from '@/server/auth';
import { arenaData, arenaError, arenaUnauthorized } from '@/server/arena/http';
import { getJobsOverview } from '@/server/career/jobs-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    return arenaData(await getJobsOverview(user.id));
  } catch (error) {
    return arenaError(error);
  }
}
