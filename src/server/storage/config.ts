import "server-only";
import { parseR2Config, type R2Config } from "./config-core";

export type { R2Config } from "./config-core";

export function getR2Config(): R2Config {
  return parseR2Config({
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    endpoint: process.env.R2_ENDPOINT,
  }, process.env.APP_ENV ?? "");
}
