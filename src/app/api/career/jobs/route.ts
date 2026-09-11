import { z } from 'zod';
import { getCurrentUser } from '@/server/auth';
import { arenaData, arenaError, arenaUnauthorized } from '@/server/arena/http';
import { getJobsOverview, JOBS_PAGE_SIZE } from '@/server/career/jobs-service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().trim().max(200).default(''),
  employmentType: z.string().trim().max(40).default(''),
  workMode: z.string().trim().max(40).default(''),
  location: z.string().trim().max(200).default(''),
  source: z.string().trim().max(120).default(''),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(JOBS_PAGE_SIZE),
});

/** Search, filters and paging run on the server over every visible opening. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return arenaData({ reason: 'VALIDATION_ERROR' }, 400);
    const { q, employmentType, workMode, location, source, offset, limit } = parsed.data;
    return arenaData(await getJobsOverview(user.id, {
      filters: { search: q, employmentType, workMode, location, sourceSlug: source },
      offset,
      limit,
    }));
  } catch (error) {
    return arenaError(error);
  }
}
