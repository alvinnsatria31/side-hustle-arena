import { arenaData, arenaError, getCurrentArenaWeek } from "@/server/arena";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return arenaData(await getCurrentArenaWeek());
  } catch (error) {
    return arenaError(error);
  }
}
