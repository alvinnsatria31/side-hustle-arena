import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog } from "@/server/db/schema";

/**
 * Public reward catalog read model (PRD §35).
 *
 * Read-only: catalog rows seeded from the locked reward SKUs (the confirmed
 * `2,000 points → USD 20` SKU plus website-proven supporting SKUs). This endpoint
 * exposes active catalog entries. Live stock and spendable balance are checked
 * transactionally by redemption-service at claim time.
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
