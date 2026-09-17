import { z } from "zod";

/**
 * Request shapes for the shop's routes.
 *
 * Kept out of the route files because a Next.js route module may only export
 * handlers and its own config — a shared schema exported from one and imported
 * by another is a build error waiting to happen. The deeper rules (what a
 * product needs before it may go on sale) live in `admin-service.ts`; this is
 * only the shape of what arrives over the wire.
 */

export const storeProductSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(300).nullish(),
  description: z.string().trim().max(8000).nullish(),
  productKind: z.enum(["DOWNLOAD", "ACCESS"]),
  status: z.enum(["DRAFT", "COMING_SOON", "ACTIVE", "ARCHIVED"]),
  priceIdrMinor: z.number().int().positive().nullish(),
  pointsCost: z.number().int().positive().nullish(),
  coverUrl: z.string().trim().max(500).nullish(),
  deliveryKind: z.enum(["LINK", "FILE"]).nullish(),
  deliveryUrl: z.string().trim().max(500).nullish(),
  deliveryObjectKey: z.string().trim().max(200).nullish(),
  deliveryFilename: z.string().trim().max(200).nullish(),
  featureKey: z.string().trim().max(64).nullish(),
  accessDurationDays: z.number().int().positive().nullish(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const storeCheckoutSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  paymentMethod: z.enum(["IDR", "POINTS"]),
});

export const storeOrderQuerySchema = z.object({
  status: z.enum(["PENDING", "PAID", "FULFILLED", "FAILED", "EXPIRED", "REFUNDED"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const storeReasonSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
export const storeSlugSchema = z.string().trim().min(1).max(64);
export const storeUploadSchema = z.object({ mimeType: z.string().trim().min(3).max(120) });
