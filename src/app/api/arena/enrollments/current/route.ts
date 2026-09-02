import { getCurrentUser } from "@/server/auth";
import { arenaData, arenaError, arenaUnauthorized, getCurrentArenaEnrollment } from "@/server/arena";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();

  try {
    return arenaData(await getCurrentArenaEnrollment({ userId: user.id }));
  } catch (error) {
    return arenaError(error);
  }
}
