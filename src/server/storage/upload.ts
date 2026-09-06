import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageClient } from "./storage-client";
import { getStorageConfig } from "./config";

export const STORAGE_PRESIGNED_PUT_TTL_SECONDS = 600;
/** @deprecated Use STORAGE_PRESIGNED_PUT_TTL_SECONDS instead. */
export const R2_PRESIGNED_PUT_TTL_SECONDS = STORAGE_PRESIGNED_PUT_TTL_SECONDS;

export async function createPresignedUpload(input: { storageKey: string; mimeType: string }) {
  if (!/^arena\/(development|production)\/[a-f0-9-]{36}$/.test(input.storageKey)) {
    throw new Error("Only staging keys may receive upload URLs.");
  }
  const config = getStorageConfig();
  return getSignedUrl(getStorageClient(), new PutObjectCommand({ Bucket: config.bucket, Key: input.storageKey, ContentType: input.mimeType }), { expiresIn: STORAGE_PRESIGNED_PUT_TTL_SECONDS });
}

export async function headPrivateObject(storageKey: string) {
  const config = getStorageConfig();
  return getStorageClient().send(new HeadObjectCommand({ Bucket: config.bucket, Key: storageKey }));
}

export async function deletePrivateObject(storageKey: string) {
  const config = getStorageConfig();
  await getStorageClient().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }), { abortSignal: AbortSignal.timeout(10_000) });
}
