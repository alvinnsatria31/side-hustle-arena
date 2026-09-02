import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "./r2-client";
import { getR2Config } from "./config";

export const R2_PRESIGNED_PUT_TTL_SECONDS = 600;

export async function createPresignedUpload(input: { storageKey: string; mimeType: string }) {
  const config = getR2Config();
  return getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: config.bucketName, Key: input.storageKey, ContentType: input.mimeType }), { expiresIn: R2_PRESIGNED_PUT_TTL_SECONDS });
}

export async function headPrivateObject(storageKey: string) {
  const config = getR2Config();
  return getR2Client().send(new HeadObjectCommand({ Bucket: config.bucketName, Key: storageKey }));
}

export async function deletePrivateObject(storageKey: string) {
  const config = getR2Config();
  await getR2Client().send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: storageKey }));
}
