import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { products } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";
import { createPresignedUpload, createStoreProductObjectKey, getStorageEnvironment, headPrivateObject } from "@/server/storage";
import { featurePath } from "./entitlement-service";

type Db = ReturnType<typeof getDb>;
type Product = typeof products.$inferSelect;

/**
 * The owner's side of the shop.
 *
 * Every rule the database enforces is checked here first, in Indonesian. The
 * constraints stay as the real guarantee — they hold whoever writes to the table
 * next, including a migration or a psql session — but a constraint violation
 * reaching the console reads as "violates check constraint
 * store_products_kind_check", which tells the person filling in a product
 * nothing about what they got wrong.
 */

export interface ProductInput {
  slug: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  productKind: "DOWNLOAD" | "ACCESS";
  status: "DRAFT" | "COMING_SOON" | "ACTIVE" | "ARCHIVED";
  priceIdrMinor?: number | null;
  pointsCost?: number | null;
  coverUrl?: string | null;
  deliveryKind?: "LINK" | "FILE" | null;
  deliveryUrl?: string | null;
  deliveryObjectKey?: string | null;
  deliveryFilename?: string | null;
  featureKey?: string | null;
  accessDurationDays?: number | null;
  sortOrder?: number;
}

function invalid(message: string): never {
  throw new ArenaDomainError("VALIDATION_ERROR", message);
}

function normalize(input: ProductInput) {
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) {
    invalid("Slug hanya boleh huruf kecil, angka, dan tanda hubung (maks. 64 karakter).");
  }
  const title = input.title.trim();
  if (!title || title.length > 160) invalid("Judul wajib diisi (maks. 160 karakter).");

  const price = input.priceIdrMinor ?? null;
  if (price !== null && (!Number.isInteger(price) || price <= 0 || price % 100 !== 0)) {
    invalid("Harga Rupiah harus bilangan bulat rupiah penuh — Midtrans tidak menagih sen.");
  }
  const pointsCost = input.pointsCost ?? null;
  if (pointsCost !== null && (!Number.isInteger(pointsCost) || pointsCost <= 0)) {
    invalid("Harga poin harus bilangan bulat lebih dari 0.");
  }

  const url = input.deliveryUrl?.trim() || null;
  if (url && !url.startsWith("https://")) invalid("Link pengiriman harus berupa URL https.");
  const coverUrl = input.coverUrl?.trim() || null;
  if (coverUrl && !coverUrl.startsWith("https://") && !coverUrl.startsWith("/")) {
    invalid("Cover harus URL https atau path lokal yang diawali /.");
  }

  const kind = input.productKind;
  const featureKey = input.featureKey?.trim() || null;
  if (featureKey && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(featureKey)) {
    invalid("Feature key hanya boleh huruf kecil, angka, dan tanda hubung.");
  }
  const accessDurationDays = input.accessDurationDays ?? null;
  if (accessDurationDays !== null && (!Number.isInteger(accessDurationDays) || accessDurationDays <= 0)) {
    invalid("Durasi akses harus lebih dari 0 hari, atau kosongkan untuk akses selamanya.");
  }

  const deliveryKind = kind === "ACCESS" ? null : input.deliveryKind ?? null;
  const objectKey = kind === "ACCESS" ? null : input.deliveryObjectKey?.trim() || null;
  const row = {
    slug,
    title,
    summary: input.summary?.trim() || null,
    description: input.description?.trim() || null,
    productKind: kind,
    status: input.status,
    priceIdrMinor: price,
    pointsCost,
    coverUrl,
    deliveryKind,
    deliveryUrl: deliveryKind === "LINK" ? url : null,
    deliveryObjectKey: deliveryKind === "FILE" ? objectKey : null,
    deliveryFilename: deliveryKind === "FILE" ? input.deliveryFilename?.trim() || null : null,
    featureKey: kind === "ACCESS" ? featureKey : null,
    accessDurationDays: kind === "ACCESS" ? accessDurationDays : null,
    sortOrder: Number.isInteger(input.sortOrder) ? input.sortOrder! : 0,
  };

  if (deliveryKind === "LINK" && !row.deliveryUrl) invalid("Produk berjenis LINK butuh alamat tujuannya.");
  if (deliveryKind === "FILE" && !row.deliveryObjectKey) invalid("Produk berjenis FILE butuh berkas yang diunggah lebih dulu.");

  /*
   * The ACTIVE gate. Nothing above this line stops an owner from saving a
   * half-filled product, and that is the point — the shop is meant to be built
   * up in pieces. What must never happen is a product going on sale that cannot
   * be paid for or cannot be delivered.
   */
  if (row.status === "ACTIVE") {
    if (row.priceIdrMinor === null && row.pointsCost === null) {
      invalid("Produk aktif butuh minimal satu harga: Rupiah, poin, atau keduanya.");
    }
    if (kind === "ACCESS") {
      if (!row.featureKey) invalid("Produk akses butuh feature key sebelum bisa dijual.");
      if (!featurePath(row.featureKey)) {
        invalid(`Feature key "${row.featureKey}" belum punya halaman. Daftarkan dulu di featurePaths (src/server/store/entitlement-service.ts).`);
      }
    } else if (!row.deliveryKind) {
      invalid("Produk unduhan butuh link atau berkas sebelum bisa dijual.");
    }
  }

  return row;
}

/** A stored object key must name a file that is really there before it goes on sale. */
async function assertObjectExists(objectKey: string): Promise<void> {
  try {
    await headPrivateObject(objectKey);
  } catch {
    invalid("Berkas produk tidak ditemukan di storage. Unggah ulang lalu simpan lagi.");
  }
}

export async function listAdminProducts(db: Db = getDb()): Promise<Product[]> {
  return db.select().from(products).orderBy(asc(products.sortOrder), asc(products.title));
}

export async function createProduct(input: {
  product: ProductInput;
  actorSubject: string;
  db?: Db;
}): Promise<Product> {
  const db = input.db ?? getDb();
  const row = normalize(input.product);
  if (row.deliveryObjectKey) await assertObjectExists(row.deliveryObjectKey);

  const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.slug, row.slug));
  if (existing) invalid(`Slug "${row.slug}" sudah dipakai produk lain.`);

  const [created] = await db.insert(products).values(row).returning();
  await writeAudit(db, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "STORE_PRODUCT_CREATED",
    entityType: "store_product",
    entityId: created.id,
    metadata: { slug: created.slug, status: created.status, productKind: created.productKind },
  });
  return created;
}

export async function updateProduct(input: {
  productId: string;
  product: ProductInput;
  actorSubject: string;
  db?: Db;
}): Promise<Product> {
  const db = input.db ?? getDb();
  const row = normalize(input.product);
  if (row.deliveryObjectKey) await assertObjectExists(row.deliveryObjectKey);

  const [before] = await db.select().from(products).where(eq(products.id, input.productId));
  if (!before) throw new ArenaDomainError("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.");

  const [clash] = await db.select({ id: products.id }).from(products).where(eq(products.slug, row.slug));
  if (clash && clash.id !== input.productId) invalid(`Slug "${row.slug}" sudah dipakai produk lain.`);

  const [updated] = await db.update(products)
    .set({ ...row, updatedAt: new Date() })
    .where(eq(products.id, input.productId))
    .returning();

  /*
   * The audit records what moved, not the whole row. A diff is what somebody
   * reads six months later asking "when did this become 149.000, and who?".
   */
  const changed = Object.fromEntries(
    Object.entries(row)
      .filter(([key, value]) => (before as Record<string, unknown>)[key] !== value)
      .map(([key, value]) => [key, { from: (before as Record<string, unknown>)[key] ?? null, to: value ?? null }]),
  );
  await writeAudit(db, {
    actorType: "ADMIN",
    actorSubject: input.actorSubject,
    action: "STORE_PRODUCT_UPDATED",
    entityType: "store_product",
    entityId: updated.id,
    metadata: { slug: updated.slug, changed },
  });
  return updated;
}

/**
 * A place to put a product file.
 *
 * The key is minted here, not accepted from the caller: a client that chose its
 * own key could hand back one belonging to a participant's submission and have
 * the shop sell it. What comes back is a one-off signed PUT and the key to save
 * on the product once the upload finishes.
 */
export async function createProductUploadUrl(input: {
  mimeType: string;
  actorSubject: string;
}): Promise<{ uploadUrl: string; storageKey: string }> {
  const mimeType = input.mimeType.trim();
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(mimeType)) invalid("Tipe berkas tidak dikenali.");
  const storageKey = createStoreProductObjectKey(getStorageEnvironment());
  const uploadUrl = await createPresignedUpload({ storageKey, mimeType });
  return { uploadUrl, storageKey };
}
