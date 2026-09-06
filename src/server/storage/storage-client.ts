import { S3Client } from "@aws-sdk/client-s3";
import { getStorageConfig } from "./config";

let client: S3Client | undefined;

/**
 * Normalize a Tencent COS endpoint to the regional form.
 *
 * A bucket-scoped endpoint (`https://<bucket>.cos.<region>.myqcloud.com`)
 * combined with virtual-hosted style makes the SDK sign
 * `<bucket>.<bucket>.cos.…`, which fails TLS. Regional
 * (`https://cos.<region>.myqcloud.com`) is always correct; anything else is
 * passed through untouched.
 */
export function normalizeCosEndpoint(endpoint: string, bucket: string): string {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    if (host === `${bucket.toLowerCase()}.cos.${host.split(".cos.")[1]}` && host.endsWith(".myqcloud.com")) {
      const region = host.split(".cos.")[1].replace(/\.myqcloud\.com$/, "");
      url.hostname = `cos.${region}.myqcloud.com`;
      return url.toString().replace(/\/$/, "");
    }
    return endpoint;
  } catch {
    return endpoint;
  }
}

export function useLocalStoragePathStyle(endpoint: string, environment = process.env.APP_ENV): boolean {
  return environment === 'development' && ['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname);
}

export function getStorageClient() {
  if (!client) {
    const config = getStorageConfig();
    // Tencent COS speaks the S3 API with virtual-hosted style addressing.
    // COS must retain virtual-host addressing; only local development S3
    // emulators use path-style URLs (no wildcard localhost DNS required).
    client = new S3Client({
      region: config.region,
      endpoint: normalizeCosEndpoint(config.endpoint, config.bucket),
      forcePathStyle: useLocalStoragePathStyle(config.endpoint),
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }
  return client;
}
