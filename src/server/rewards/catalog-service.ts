import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog } from "@/server/db/schema";

/**
 * Public reward catalog read model (PRD §35).
 *
 * Read-only: the six official reward SKUs (300 → 2.700 points, main reward
 * CASH REWARD Rp500.000). This exposes active catalog entries. Live stock and
 * spendable balance are checked transactionally by redemption-service at claim
 * time.
 */
export interface PublicCatalogItem {
  slug: string;
  title: string;
  description: string | null;
  pointsCost: number;
  rewardType: string;
  inventoryMode: string;
}

export async function listActiveCatalogItems(): Promise<PublicCatalogItem[]> {
  const rows = await getDb()
    .select({
      slug: catalog.slug,
      title: catalog.title,
      description: catalog.description,
      pointsCost: catalog.pointsCost,
      rewardType: catalog.rewardType,
      inventoryMode: catalog.inventoryMode,
    })
    .from(catalog)
    .where(eq(catalog.isActive, true))
    .orderBy(asc(catalog.pointsCost));
  return rows;
}
