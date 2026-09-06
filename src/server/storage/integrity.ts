import "server-only";
import { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { unzipSync } from "fflate";
import { ArenaDomainError } from "@/server/arena/errors";
import { getStorageClient } from "./storage-client";
import { getStorageConfig } from "./config";

export const MAX_OBJECT_BYTES = 20 * 1024 * 1024;
export type StorageTransport = { client: Pick<S3Client, "send">; bucket: string };
export type ObjectReadOptions = { maxBytes?: number; expectedSizeBytes?: number; expectedChecksum?: string | null };

function invalid(message: string): never {
  throw new ArenaDomainError("UPLOAD_VALIDATION_FAILED", message);
}

function officeSignature(bytes: Buffer, mimeType: string): boolean {
  const formats: Record<string, [string, string]> = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["word/document.xml", "wordprocessingml.document.main+xml"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["ppt/presentation.xml", "presentationml.presentation.main+xml"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xl/workbook.xml", "spreadsheetml.sheet.main+xml"],
  };
  const format = formats[mimeType];
  if (!format || bytes.readUInt32LE(0) !== 0x04034b50) return false;
  let total = 0;
  const names = new Set<string>();
  const files = unzipSync(bytes, { filter(entry) {
    total += entry.originalSize;
    if (names.has(entry.name) || names.size >= 4096 || total > 100 * 1024 * 1024
      || /vbaProject\.bin$/i.test(entry.name) || entry.name.split("/").includes("..")) {
      invalid("Unsupported Office content.");
    }
    names.add(entry.name);
    // Only inflate the small content-type manifest. The document itself is
    // parsed by the extraction provider, with its own resource limits.
    if (entry.name !== "[Content_Types].xml") return false;
    if (entry.originalSize > 1024 * 1024) invalid("Office content manifest exceeds size limit.");
    return true;
  } });
  const manifest = Buffer.from(files["[Content_Types].xml"] ?? []).toString("utf8");
  return names.has(format[0]) && manifest.includes(`/${format[0]}`)
    && manifest.includes(`application/vnd.openxmlformats-officedocument.${format[1]}`)
    && !/macroEnabled|<!DOCTYPE|<!ENTITY/i.test(manifest);
}

/** Format signatures are admission checks, not malware scanning or full decoding. */
export function assertContentSignature(bytes: Buffer, mimeType: string): void {
  let valid = false;
  try {
    if (mimeType === "application/pdf") {
      valid = /^%PDF-[12]\.\d/.test(bytes.subarray(0, 8).toString("ascii"))
        && bytes.subarray(-1024).includes(Buffer.from("%%EOF"));
    } else if (mimeType === "image/png") {
      valid = bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        && bytes.readUInt32BE(8) === 13 && bytes.toString("ascii", 12, 16) === "IHDR"
        && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0
        && bytes.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]));
    } else if (mimeType === "image/jpeg") {
      valid = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
    } else if (mimeType === "image/webp") {
      valid = bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF"
        && bytes.readUInt32LE(4) + 8 === bytes.length && bytes.toString("ascii", 8, 12) === "WEBP"
        && ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16));
    } else if (mimeType === "text/csv") {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      valid = text.trim().length > 0 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)
        && !/^\s*(?:<|%PDF-|PK\x03\x04)/i.test(text);
    } else if (bytes.length >= 4) {
      valid = officeSignature(bytes, mimeType);
    }
  } catch {
    invalid("Uploaded content signature is invalid or unsupported.");
  }
  if (!valid) invalid("Uploaded content signature does not match its declared type.");
}

/** Trusted server callers only: authorize an item before passing its database key. */
export async function downloadObjectBytes(storageKey: string, options: ObjectReadOptions = {}, transport?: StorageTransport) {
  const maxBytes = options.maxBytes ?? MAX_OBJECT_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_OBJECT_BYTES) invalid("Invalid object size limit.");
  if (options.expectedChecksum != null && !/^[a-f0-9]{64}$/i.test(options.expectedChecksum)) invalid("Invalid expected checksum.");
  const storage = transport ?? { client: getStorageClient(), bucket: getStorageConfig().bucket };
  const abortSignal = AbortSignal.timeout(30_000);
  const object = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: storageKey }), { abortSignal });
  const body = object.Body;
  if (!body || !(Symbol.asyncIterator in body)) invalid("Object content stream is unavailable.");
  const stream = body as AsyncIterable<Uint8Array> & { destroy?: () => void };
  const close = () => stream.destroy?.();
  abortSignal.addEventListener("abort", close, { once: true });
  try {
    if (object.ContentLength !== undefined && object.ContentLength > maxBytes) invalid("Object exceeds size limit.");
    const chunks: Buffer[] = [];
    let sizeBytes = 0;
    const hash = createHash("sha256");
    for await (const chunk of stream) {
      abortSignal.throwIfAborted();
      sizeBytes += chunk.byteLength;
      if (sizeBytes > maxBytes) invalid("Object exceeds size limit.");
      const bytes = Buffer.from(chunk);
      chunks.push(bytes);
      hash.update(bytes);
    }
    if (sizeBytes === 0 || (object.ContentLength !== undefined && sizeBytes !== object.ContentLength)
      || (options.expectedSizeBytes !== undefined && sizeBytes !== options.expectedSizeBytes)) invalid("Object size does not match expected size.");
    const checksum = hash.digest("hex");
    if (options.expectedChecksum && checksum !== options.expectedChecksum.toLowerCase()) invalid("Object checksum does not match expected checksum.");
    return { bytes: Buffer.concat(chunks, sizeBytes), checksum, sizeBytes, mimeType: object.ContentType ?? null };
  } finally {
    abortSignal.removeEventListener("abort", close);
    close();
  }
}

export async function createImmutableSnapshot(input: {
  sourceKey: string; snapshotKey: string; mimeType: string; sizeBytes: number; checksum?: string | null;
}, transport?: StorageTransport) {
  if (!/^arena\/(development|production)\/snapshots\/[a-f0-9-]{36}$/.test(input.snapshotKey)
    || input.sourceKey === input.snapshotKey) invalid("Invalid immutable snapshot key.");
  const storage = transport ?? { client: getStorageClient(), bucket: getStorageConfig().bucket };
  const source = await downloadObjectBytes(input.sourceKey, {
    expectedSizeBytes: input.sizeBytes, expectedChecksum: input.checksum,
  }, storage);
  assertContentSignature(source.bytes, input.mimeType);
  await storage.client.send(new PutObjectCommand({
    Bucket: storage.bucket, Key: input.snapshotKey, Body: source.bytes,
    ContentType: input.mimeType, ContentLength: source.sizeBytes,
    ContentMD5: createHash("md5").update(source.bytes).digest("base64"),
    Metadata: { sha256: source.checksum }, IfNoneMatch: "*",
  }), { abortSignal: AbortSignal.timeout(30_000) });
  // Do not trust an ETag as a SHA-256 or assume a compatible provider honored
  // all checksum headers. Read back the exact destination before referencing it.
  await downloadObjectBytes(input.snapshotKey, { expectedSizeBytes: source.sizeBytes, expectedChecksum: source.checksum }, storage);
  return { storageKey: input.snapshotKey, checksum: source.checksum, sizeBytes: source.sizeBytes };
}
