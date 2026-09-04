import { arenaData, arenaError } from "@/server/arena";
import { listActiveCatalogItems } from "@/server/rewards/catalog-service";

export const dynamic = "force-dynamic";

/** Public reward ladder. Authenticated redemption is Phase 7 (not yet). */
export async function GET() {
  try {
    return arenaData(await listActiveCatalogItems());
  } catch (error) {
    return arenaError(error);
  }
}
