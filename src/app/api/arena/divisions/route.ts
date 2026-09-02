import { arenaData, arenaError, listActiveArenaDivisions } from "@/server/arena";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return arenaData(await listActiveArenaDivisions());
  } catch (error) {
    return arenaError(error);
  }
}
