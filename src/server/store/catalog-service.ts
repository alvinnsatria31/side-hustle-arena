import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { entitlements, products } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { isRupiahCheckoutConfigured, rupiahCheckoutEnvironment } from "./config";
import { isLiveEntitlement } from "./entitlement-service";

/**
 * The shelf.
 *
 * Read-only, and careful about what it exposes: a product row also holds where
 * the goods are (`delivery_url`, `delivery_object_key`) and which feature a
 * purchase unlocks. None of that is anybody's business before they have paid,
 * so the public shapes below are built column by column rather than by spreading
 * the row and deleting what should not have been selected.
 */

export interface StoreListItem {
  slug: string;
  title: string;
  summary: string | null;
  productKind: "DOWNLOAD" | "ACCESS";
  status: "COMING_SOON" | "ACTIVE";
  priceIdrMinor: number | null;
  pointsCost: number | null;
  coverUrl: string | null;
  /** Null on a DOWNLOAD, and on ACCESS means the key never expires. */
  accessDurationDays: number | null;
}

export interface StoreProductDetail extends StoreListItem {
  description: string | null;
  /** How this product may be paid for right now, gateway configuration included. */
  payWithRupiah: boolean;
  payWithPoints: boolean;
  /** "sandbox" means a rupiah payment here is a test and collects no money. */
  paymentEnvironment: "sandbox" | "production" | null;
}

const shelfStatuses = ["ACTIVE", "COMING_SOON"] as const;

const listColumns = {
  slug: products.slug,
  title: products.title,
  summary: products.summary,
  productKind: products.productKind,
  status: products.status,
  priceIdrMinor: products.priceIdrMinor,
  pointsCost: products.pointsCost,
  coverUrl: products.coverUrl,
  accessDurationDays: products.accessDurationDays,
};

/**
 * Everything on the shelf, sellable or merely announced.
 *
 * COMING_SOON rows are returned on purpose: an application that does not exist
 * yet still earns its place on the shelf, and the caller renders it with a dead
 * button. Hiding it would mean the shop can only ever show what is finished.
 */
export async function listStoreProducts(): Promise<StoreListItem[]> {
  const rows = await getDb()
    .select(listColumns)
    .from(products)
    .where(inArray(products.status, [...shelfStatuses]))
    .orderBy(asc(products.sortOrder), asc(products.title));
  return rows as StoreListItem[];
}

export async function getStoreProduct(slug: string): Promise<StoreProductDetail> {
  const [row] = await getDb()
    .select({ ...listColumns, description: products.description })
    .from(products)
    .where(and(eq(products.slug, slug), inArray(products.status, [...shelfStatuses])));
  if (!row) throw new ArenaDomainError("PRODUCT_NOT_FOUND", "Produk ini tidak tersedia.");
  /*
   * A price is not an offer. Rupiah also needs a working gateway, and a product
   * that is merely announced is not for sale at any price — so what the buyer is
   * told about payment is computed here rather than inferred from the price
   * columns by each caller, where the two would drift apart.
   */
  const sellable = row.status === "ACTIVE";
  return {
    ...(row as StoreListItem & { description: string | null }),
    payWithRupiah: sellable && row.priceIdrMinor !== null && isRupiahCheckoutConfigured(),
    payWithPoints: sellable && row.pointsCost !== null,
    paymentEnvironment: rupiahCheckoutEnvironment(),
  };
}

/**
 * Which of these products the signed-in person already owns.
 *
 * Returned as slugs so the shelf can mark them without a second round trip, and
 * scoped to live grants — a revoked one is history, not a possession.
 */
export async function listOwnedSlugs(userId: string, now = new Date()): Promise<string[]> {
  const rows = await getDb()
    .select({ slug: products.slug })
    .from(entitlements)
    .innerJoin(products, eq(products.id, entitlements.productId))
    .where(and(eq(entitlements.userId, userId), isLiveEntitlement(now)));
  return rows.map((row) => row.slug);
}
