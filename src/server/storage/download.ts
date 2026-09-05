import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageClient } from "./storage-client";
import { getStorageConfig } from "./config";

export const STORAGE_SIGNED_GET_TTL_SECONDS = 600;
/** @deprecated Use STORAGE_SIGNED_GET_TTL_SECONDS instead. */
export const R2_SIGNED_GET_TTL_SECONDS = STORAGE_SIGNED_GET_TTL_SECONDS;

/** Characters that would break out of a quoted header value, and anything non-ASCII. */
const UNSAFE_IN_HEADER = /[^\u0020-\u007E]|["\\]/g;

/**
 * Ask storage to name the download.
 *
 * A browser ignores `<a download>` on a cross-origin URL, so a signed link to
 * the bucket saves the object under the last path segment — our random storage
 * key. The participant would get back "dda570bc-….pdf" instead of the file they
 * uploaded. Putting the name in Content-Disposition makes the answer come from
 * the object store itself, which no cross-origin rule strips.
 *
 * Both forms are sent: `filename` as an ASCII fallback and RFC 5987
 * `filename*` for the rest, since submissions arrive named in Indonesian, with
 * spaces, and occasionally with an emoji.
 */
function contentDisposition(filename: string | null): string | undefined {
  const name = filename?.trim();
  if (!name) return undefined;
  const ascii = name.replace(UNSAFE_IN_HEADER, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function createPresignedDownload(storageKey: string, filename?: string | null) {
  const config = getStorageConfig();
  return getSignedUrl(
    getStorageClient(),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      ResponseContentDisposition: contentDisposition(filename ?? null),
    }),
    { expiresIn: STORAGE_SIGNED_GET_TTL_SECONDS },
  );
}
