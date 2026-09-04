import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageClient } from "./storage-client";
import { getStorageConfig } from "./config";

export const STORAGE_SIGNED_GET_TTL_SECONDS = 600;
/** @deprecated Use STORAGE_SIGNED_GET_TTL_SECONDS instead. */
export const R2_SIGNED_GET_TTL_SECONDS = STORAGE_SIGNED_GET_TTL_SECONDS;

export async function createPresignedDownload(storageKey: string) {
  const config = getStorageConfig();
  return getSignedUrl(getStorageClient(), new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }), { expiresIn: STORAGE_SIGNED_GET_TTL_SECONDS });
}
