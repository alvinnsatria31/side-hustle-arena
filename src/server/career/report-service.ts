import 'server-only';
import { getParticipantOverview } from '@/server/arena/participant-service';
import { getDb } from '@/server/db/client';
import { buildCareerReport } from './report';

export async function getCareerReport(userId: string, db = getDb()) {
  return buildCareerReport(await getParticipantOverview(userId, db));
}
