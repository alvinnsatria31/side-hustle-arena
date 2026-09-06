import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

assert.equal(process.env.APP_ENV, "development", "Storage live E2E requires APP_ENV=development");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

const { createPresignedUpload, headPrivateObject, deletePrivateObject } = await import("../src/server/storage/upload.ts");
const { createPresignedDownload } = await import("../src/server/storage/download.ts");
const { normalizeCosEndpoint } = await import("../src/server/storage/storage-client.ts");

test("COS endpoint normalization keeps regional endpoints and strips bucket-scoped ones", () => {
  assert.equal(
    normalizeCosEndpoint("https://cos.ap-jakarta.myqcloud.com", "arena-files-1250000000"),
    "https://cos.ap-jakarta.myqcloud.com",
  );
  assert.equal(
    normalizeCosEndpoint("https://arena-files-1250000000.cos.ap-jakarta.myqcloud.com", "arena-files-1250000000"),
    "https://cos.ap-jakarta.myqcloud.com",
  );
  assert.equal(
    normalizeCosEndpoint("https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com", "legacy-bucket"),
    "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com",
  );
});

function hasStorageEnv() {
  return Boolean(
    (process.env.STORAGE_BUCKET ?? process.env.TENCENT_COS_BUCKET ?? process.env.R2_BUCKET_NAME) &&
    (process.env.STORAGE_ACCESS_KEY_ID ?? process.env.TENCENT_COS_SECRET_ID ?? process.env.R2_ACCESS_KEY_ID) &&
    (process.env.STORAGE_SECRET_ACCESS_KEY ?? process.env.TENCENT_COS_SECRET_KEY ?? process.env.R2_SECRET_ACCESS_KEY)
  );
}

test("live object-storage roundtrip: presign PUT → upload → HEAD → presigned GET → verify bytes → delete", async (t) => {
  if (!hasStorageEnv()) {
    t.skip("No object-storage credentials in .env — see docs/backend/TENCENT_COS_SETUP.md");
    return;
  }
  // Staging keys are server-issued UUIDs (see createSubmissionObjectKey) —
  // the presign endpoint refuses anything else, so the probe uses one too.
  const key = `arena/development/${randomUUID()}`;
  const body = `arena e2e probe ${new Date().toISOString()}`;

  const uploadUrl = await createPresignedUpload({ storageKey: key, mimeType: "text/plain" });
  assert.match(uploadUrl, /^https:\/\//);
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "text/plain" }, body });
  assert.ok(put.ok, `direct PUT failed: HTTP ${put.status}`);

  const head = await headPrivateObject(key);
  assert.equal(head.ContentType, "text/plain");
  assert.equal(head.ContentLength, Buffer.byteLength(body));

  const downloadUrl = await createPresignedDownload(key);
  const got = await (await fetch(downloadUrl)).text();
  assert.equal(got, body);

  await deletePrivateObject(key);
  // Tencent COS surfaces a deleted key as SDK `NotFound` (no space), unlike
  // AWS S3's `NoSuchKey`/`404` wording — accept all three spellings.
  await assert.rejects(() => headPrivateObject(key), /not\s*found|no such key|404/i);
});
