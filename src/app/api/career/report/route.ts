import { getCurrentUser } from '@/server/auth';
import { arenaData, arenaError, arenaUnauthorized } from '@/server/arena/http';
import { getCareerReport } from '@/server/career/report-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    return arenaData(await getCareerReport(user.id));
  } catch (error) {
    return arenaError(error);
  }
}
