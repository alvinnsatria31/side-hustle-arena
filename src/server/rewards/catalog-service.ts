import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { catalog } from "@/server/db/schema";

/**
 * Public reward catalog read model (PRD §35).
 *
 * Read-only: catalog rows seeded from the locked reward SKUs (the confirmed
 * `2,000 points → USD 20` SKU plus website-proven supporting SKUs). Redemption,
 * inventory locking, fulfillment, and reversal remain Phase 7 work — this
 * endpoint only exposes what is currently claimable so the frontend can render
 * the ladder without touching ledger writes.
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
