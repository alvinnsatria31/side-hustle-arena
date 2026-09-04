import { z } from "zod";

// Generic S3-compatible object storage configuration.
//
// Locked architecture decision:
// - Deploy target: Vercel (serverless, no local disk)
// - File bytes: Tencent Cloud COS (S3-compatible API, private bucket)
// - Text/metadata/state: Neon PostgreSQL (Drizzle)
//
// The bucket must stay private: browsers only ever touch short-lived
// presigned PUT/GET URLs, and no permanent public object URL is stored
// or emitted. Tencent COS uses the REGIONAL endpoint shape:
//   https://cos.<region>.myqcloud.com        (correct)
// never the bucket-scoped shape:
//   https://<bucket>.cos.<region>.myqcloud.com  (wrong — the SDK prepends
//   the bucket itself, doubling it and breaking TLS)

const storageConfigSchema = z.object({
  bucket: z.string().trim().min(3).max(63),
  // Tencent COS region id, e.g. "ap-jakarta". Legacy R2 configs that have
  // no region concept use "auto".
  region: z.string().trim().min(1).max(32),
  accessKeyId: z.string().trim().min(1),
  secretAccessKey: z.string().trim().min(1),
  endpoint: z.string().url(),
});

export type StorageConfig = z.infer<typeof storageConfigSchema>;

function isAllowedEndpoint(hostname: string, environment: string): boolean {
  const host = hostname.toLowerCase();
  // Tencent Cloud COS (primary file backend).
  if (host.endsWith(".myqcloud.com")) return true;
  // Legacy Cloudflare R2 (transitional fallback only).
  if (host.endsWith(".r2.cloudflarestorage.com")) return true;
  // Local S3 emulators (MinIO/Garage) for development only.
  if (environment === "development" && (host === "localhost" || host === "127.0.0.1")) return true;
  return false;
}

export function parseStorageConfig(input: unknown, environment: string): StorageConfig {
  if (environment !== "development" && environment !== "production") {
    throw new Error("Storage is configured only for development or production (Vercel) in this phase.");
  }
  const parsed = storageConfigSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid object storage configuration.");
  const url = new URL(parsed.data.endpoint);
  if (url.protocol !== "https:" && !(environment === "development" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"))) {
    throw new Error("Invalid object storage configuration: endpoint must use HTTPS.");
  }
  if (!isAllowedEndpoint(url.hostname, environment)) {
    throw new Error("Invalid object storage configuration: unsupported endpoint host.");
  }
  return parsed.data;
}

// --- Deprecated R2-specific aliases (transitional, do not use in new code) ---

export type R2Config = StorageConfig;

export function parseR2Config(input: unknown, environment: string): R2Config {
  const legacy = input as Record<string, unknown>;
  return parseStorageConfig(
    {
      bucket: legacy["bucketName"] ?? legacy["bucket"],
      region: legacy["region"] ?? "auto",
      accessKeyId: legacy["accessKeyId"],
      secretAccessKey: legacy["secretAccessKey"],
      endpoint: legacy["endpoint"],
    },
    environment,
  );
}
