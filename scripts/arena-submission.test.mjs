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

test("R2 configuration is server-only, development-scoped, and rejects incomplete endpoints", () => {
  const valid = {
    accountId: "a".repeat(32),
    accessKeyId: "access-key",
    secretAccessKey: "secret-key",
    bucketName: "side-hustle-arena-dev",
    endpoint: `https://${"a".repeat(32)}.r2.cloudflarestorage.com`,
  };
  assert.equal(storageConfig.parseR2Config(valid, "development").bucketName, valid.bucketName);
  assert.throws(() => storageConfig.parseR2Config({ ...valid, endpoint: "http://example.test" }, "development"), /invalid/i);
  assert.throws(() => storageConfig.parseR2Config({ ...valid, endpoint: "https://other.r2.cloudflarestorage.com" }, "development"), /invalid/i);
  assert.throws(() => storageConfig.parseR2Config({ ...valid, bucketName: "side-hustle-arena" }, "production"), /configured only/i);
});

test("the R2 environment reader is explicitly server-only", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/server/storage/config.ts", import.meta.url), "utf8"));
  assert.match(source, /import\s+["']server-only["']/);
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
