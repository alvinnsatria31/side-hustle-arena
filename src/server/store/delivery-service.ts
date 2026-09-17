import "server-only";
import { getDb } from "@/server/db/client";
import { ArenaDomainError } from "@/server/arena/errors";
import { createPresignedDownload, STORAGE_SIGNED_GET_TTL_SECONDS } from "@/server/storage";
import { writeAudit } from "@/server/reviews/audit";
import { featurePath, findEntitlementForDownload } from "./entitlement-service";

type Db = ReturnType<typeof getDb>;

/**
 * Handing over the goods.
 *
 * The last step of a purchase, and the only one a buyer repeats: a download is
 * fetched again from a new laptop, a licence is opened every time the
 * application is used. So this is not part of checkout — it is a separate,
 * repeatable act gated on ownership, which is exactly what an entitlement is.
 */

export type Delivery =
  | { kind: "LINK"; url: string }
  /** Signed, short-lived, and re-issued on demand rather than stored anywhere. */
  | { kind: "FILE"; url: string; filename: string | null; expiresInSeconds: number }
  | { kind: "ACCESS"; path: string };

/**
 * Issue the goods for a product this person owns.
 *
 * Ownership is re-checked on every call. A signed URL handed out once would
 * otherwise outlive a refund, and an `ACCESS` path returned from a stale list
 * would outlive a revocation — both are the same mistake, so both are answered
 * from the same live lookup.
 */
export async function deliverOwnedProduct(input: {
  userId: string;
  slug: string;
  db?: Db;
}): Promise<Delivery> {
  const db = input.db ?? getDb();
  const { product, entitlement } = await findEntitlementForDownload({ userId: input.userId, slug: input.slug, db });

  if (product.productKind === "ACCESS") {
    const path = featurePath(entitlement.featureKey);
    if (!path) {
      /*
       * A key with nowhere to go. It means a product was activated with a
       * feature key no page answers to — a configuration mistake, not the
       * buyer's problem, so it says so plainly instead of 404-ing them.
       */
      throw new ArenaDomainError("PRODUCT_NOT_PURCHASABLE", "Akses produk ini belum bisa dibuka. Tim kami sudah diberi tahu.");
    }
    return { kind: "ACCESS", path };
  }

  if (product.deliveryKind === "LINK" && product.deliveryUrl) {
    return { kind: "LINK", url: product.deliveryUrl };
  }

  if (product.deliveryKind === "FILE" && product.deliveryObjectKey) {
    const url = await createPresignedDownload(product.deliveryObjectKey, product.deliveryFilename);
    /*
     * Audited because this is the point where a purchase becomes a file on
     * somebody's disk. A product leaking is investigated by asking who fetched
     * it and when, and that question has no answer unless the fetch is recorded.
     */
    await writeAudit(db, {
      actorType: "USER",
      actorSubject: input.userId,
      action: "STORE_PRODUCT_DOWNLOADED",
      entityType: "store_entitlement",
      entityId: entitlement.id,
      metadata: { slug: product.slug },
    });
    return { kind: "FILE", url, filename: product.deliveryFilename, expiresInSeconds: STORAGE_SIGNED_GET_TTL_SECONDS };
  }

  throw new ArenaDomainError("PRODUCT_NOT_PURCHASABLE", "Berkas produk ini belum disiapkan. Tim kami sudah diberi tahu.");
}
