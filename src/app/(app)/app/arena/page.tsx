import ParticipantDashboard from '@/components/arena/ParticipantDashboard';
import { getPublicArenaHome } from '@/lib/arena-view';

export default async function AppArenaPage() {
  const home = await getPublicArenaHome().catch(() => null);
  return <ParticipantDashboard projects={home?.projects ?? []} />;
}
