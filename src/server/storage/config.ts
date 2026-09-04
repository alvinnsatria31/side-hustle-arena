import "server-only";
import { parseStorageConfig, type StorageConfig } from "./config-core";

export type { StorageConfig } from "./config-core";
export type { R2Config } from "./config-core";

/** Object-key environment scope. Mirrors APP_ENV: "production" on Vercel. */
export function getStorageEnvironment(): "development" | "production" {
  return process.env.APP_ENV === "production" ? "production" : "development";
}

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

export function getStorageConfig(): StorageConfig {
  // Canonical STORAGE_* first, then Tencent COS names (as used in this
  // repo's .env), then legacy R2_* transitional fallback.
  const bucket = readEnv("STORAGE_BUCKET", "TENCENT_COS_BUCKET", "R2_BUCKET_NAME");
  const region = readEnv("STORAGE_REGION", "COS_REGION", "TENCENT_COS_REGION") ?? "auto";
  const endpoint =
    readEnv("STORAGE_ENDPOINT", "TENCENT_COS_ENDPOINT", "R2_ENDPOINT") ?? deriveCosEndpoint(bucket, region);
  return parseStorageConfig(
    {
      bucket,
      region,
      accessKeyId: readEnv("STORAGE_ACCESS_KEY_ID", "TENCENT_COS_SECRET_ID", "R2_ACCESS_KEY_ID"),
      secretAccessKey: readEnv("STORAGE_SECRET_ACCESS_KEY", "TENCENT_COS_SECRET_KEY", "R2_SECRET_ACCESS_KEY"),
      endpoint,
    },
    process.env.APP_ENV ?? "",
  );
}

/**
 * Tencent COS regional endpoint derived from the region, so the endpoint env
 * var is optional in the standard setup.
 *
 * Must be REGIONAL (`https://cos.<region>.myqcloud.com`), never bucket-scoped
 * (`https://<bucket>.cos.<region>.myqcloud.com`): the S3 SDK already prepends
 * the bucket for virtual-hosted style, so a bucket-scoped endpoint doubles it
 * (`<bucket>.<bucket>.cos.…`) and TLS fails. storage-client also normalizes a
 * bucket-scoped endpoint defensively for the same reason.
 */
function deriveCosEndpoint(bucket: string | undefined, region: string): string | undefined {
  if (!bucket || region === "auto") return undefined;
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(bucket)) return undefined;
  return `https://cos.${region}.myqcloud.com`;
}

/** @deprecated Use getStorageConfig instead. */
export function getR2Config(): StorageConfig {
  return getStorageConfig();
}
