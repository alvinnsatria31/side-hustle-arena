import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "./r2-client";
import { getR2Config } from "./config";

export const R2_SIGNED_GET_TTL_SECONDS = 600;

export async function createPresignedDownload(storageKey: string) {
  const config = getR2Config();
  return getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: config.bucketName, Key: storageKey }), { expiresIn: R2_SIGNED_GET_TTL_SECONDS });
}
