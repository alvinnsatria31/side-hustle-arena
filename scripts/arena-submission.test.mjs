import assert from "node:assert/strict";
import test from "node:test";

const schemas = await import("../src/server/submissions/schemas.ts");
const storage = await import("../src/server/storage/object-key.ts");
const storageConfig = await import("../src/server/storage/config-core.ts");
const access = await import("../src/server/submissions/url-access.ts");

test("submission schemas accept supported upload metadata and reject identity injection, unsafe links, and oversized requests", () => {
  const valid = schemas.uploadPresignSchema.parse({
    requirementId: "0d224c11-a09f-41dd-8c7c-63484e7f7a0b",
    filename: "analysis.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1_024,
  });
  assert.equal(valid.filename, "analysis.pdf");
  assert.equal(schemas.uploadPresignSchema.safeParse({ ...valid, userId: "attacker" }).success, false);
  assert.equal(schemas.uploadPresignSchema.safeParse({ ...valid, filename: "x".repeat(256) }).success, false);
  assert.equal(schemas.draftLinkSchema.safeParse({ requirementId: valid.requirementId, url: "http://example.com" }).success, false);
  assert.equal(schemas.draftLinkSchema.safeParse({ requirementId: valid.requirementId, url: "https://user:pass@example.com" }).success, false);
  assert.equal(schemas.draftLinkSchema.parse({ requirementId: valid.requirementId, url: "https://github.com/example/project" }).url, "https://github.com/example/project");
});

test("storage keys are random, environment-scoped, and never derive from an original filename or profile", () => {
  const first = storage.createSubmissionObjectKey("development");
  const second = storage.createSubmissionObjectKey("development");
  assert.match(first, /^arena\/development\/[a-f0-9-]{36}$/);
  assert.notEqual(first, second);
  assert.equal(first.includes("analysis.pdf"), false);
});

test("object storage configuration is server-gated and accepts Tencent COS or legacy R2 endpoints", () => {
  const tencent = {
    bucket: "arena-files-1250000000",
    region: "ap-jakarta",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key",
    endpoint: "https://arena-files-1250000000.cos.ap-jakarta.myqcloud.com",
  };
  assert.equal(storageConfig.parseStorageConfig(tencent, "development").bucket, tencent.bucket);
  assert.equal(storageConfig.parseStorageConfig(tencent, "production").region, "ap-jakarta");
  const legacyR2 = {
    bucket: "side-hustle-arena-dev",
    region: "auto",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key",
    endpoint: "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com",
  };
  assert.equal(storageConfig.parseStorageConfig(legacyR2, "development").bucket, legacyR2.bucket);
  assert.throws(() => storageConfig.parseStorageConfig({ ...tencent, endpoint: "http://arena-files-1250000000.cos.ap-jakarta.myqcloud.com" }, "development"), /invalid/i);
  assert.throws(() => storageConfig.parseStorageConfig({ ...tencent, endpoint: "https://files.example.com" }, "development"), /invalid/i);
  assert.throws(() => storageConfig.parseStorageConfig(tencent, "staging"), /development or production/i);
  // Deprecated R2-shaped input still parses through the compatibility alias.
  assert.equal(storageConfig.parseR2Config({ ...legacyR2, bucketName: legacyR2.bucket, endpoint: legacyR2.endpoint }, "development").bucket, legacyR2.bucket);
});

test("the object storage environment reader is explicitly server-only", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/server/storage/config.ts", import.meta.url), "utf8"));
  assert.match(source, /import\s+["']server-only["']/);
});

test("probe order prefers IPv4, dedupes, and keeps every address vetted", () => {
  assert.deepEqual(
    access.orderAddressesForProbe(["2606:4700:10::6814:179a", "93.184.216.34", "93.184.216.34", "172.66.147.243"]),
    ["93.184.216.34", "172.66.147.243", "2606:4700:10::6814:179a"],
  );
  assert.deepEqual(access.orderAddressesForProbe([]), []);
});

test("SSRF URL policy rejects non-HTTPS, credentials, private IPv4, IPv6, and metadata targets", async () => {
  await assert.rejects(() => access.assertSafeExternalUrl("http://example.com", { resolve: async () => ["93.184.216.34"] }), /blocked/i);
  await assert.rejects(() => access.assertSafeExternalUrl("https://user:pass@example.com", { resolve: async () => ["93.184.216.34"] }), /blocked/i);
  await assert.rejects(() => access.assertSafeExternalUrl("https://example.com", { resolve: async () => ["127.0.0.1"] }), /blocked/i);
  await assert.rejects(() => access.assertSafeExternalUrl("https://example.com", { resolve: async () => ["10.0.0.1"] }), /blocked/i);
  await assert.rejects(() => access.assertSafeExternalUrl("https://example.com", { resolve: async () => ["169.254.169.254"] }), /blocked/i);
  await assert.rejects(() => access.assertSafeExternalUrl("https://example.com", { resolve: async () => ["::1"] }), /blocked/i);
  await assert.rejects(() => access.assertSafeExternalUrl("https://example.com", { resolve: async () => ["::ffff:127.0.0.1"] }), /blocked/i);
  await assert.rejects(() => access.assertSafeExternalUrl("https://example.com", { resolve: async () => ["198.51.100.4"] }), /blocked/i);
  const safe = await access.assertSafeExternalUrl("https://example.com/path", { resolve: async () => ["93.184.216.34"] });
  assert.deepEqual(safe.addresses, ["93.184.216.34"]);
});

test("external URL checks pin safe DNS addresses and revalidate every redirect", async () => {
  const redirects = [];
  const result = await access.checkExternalUrlAccess("https://example.test/start", {
    resolve: async (hostname) => hostname === "example.test" ? ["93.184.216.34"] : ["127.0.0.1"],
    probe: async ({ url, addresses }) => {
      redirects.push({ url: url.toString(), addresses });
      return { statusCode: 302, location: "https://internal.test/private" };
    },
  }).catch((error) => error);
  assert.match(result.message, /Blocked external URL target/);
  assert.deepEqual(redirects, [{ url: "https://example.test/start", addresses: ["93.184.216.34"] }]);
});
