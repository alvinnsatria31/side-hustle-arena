import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import { assertContentSignature, downloadObjectBytes, createImmutableSnapshot } from "../src/server/storage/integrity.ts";
import { cleanupUnusedObjects } from "../src/server/storage/cleanup-core.ts";

const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const checksum = createHash("sha256").update(pdf).digest("hex");
const sourceKey = "arena/development/11111111-1111-4111-8111-111111111111";
const snapshotKey = "arena/development/snapshots/22222222-2222-4222-8222-222222222222";
function fakeStorage(body = pdf) {
  const objects = new Map([[sourceKey, Buffer.from(body)]]);
  const calls = [];
  return { objects, calls, client: { async send(command) {
    calls.push(command);
    const { Key, Body } = command.input;
    if (command.constructor.name === "GetObjectCommand") {
      const bytes = objects.get(Key);
      if (!bytes) throw new Error("Missing object");
      return { Body: Readable.from([bytes]), ContentLength: bytes.length, ContentType: "application/pdf" };
    }
    if (command.constructor.name === "PutObjectCommand") {
      assert.equal(command.input.IfNoneMatch, "*");
      assert.equal(objects.has(Key), false);
      objects.set(Key, Buffer.from(Body));
      return {};
    }
    throw new Error("Unexpected storage command");
  } }, bucket: "fake-bucket" };
}

test("actual signatures reject declared MIME spoofing, truncated containers and binary CSV", () => {
  assert.doesNotThrow(() => assertContentSignature(pdf, "application/pdf"));
  assert.doesNotThrow(() => assertContentSignature(Buffer.from('name,value\n"one,two",3\n'), "text/csv"));
  for (const [bytes, mime] of [
    [Buffer.from("<html>fake pdf</html>"), "application/pdf"],
    [pdf, "image/png"], [Buffer.from("%PDF-1.7"), "application/pdf"],
    [Buffer.from([0, 1, 2]), "text/csv"], [Buffer.from("<script>alert(1)</script>"), "text/csv"],
    [Buffer.from("PK\x03\x04word/document.xml"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ]) assert.throws(() => assertContentSignature(bytes, mime), /signature|content/i);
});

test("bounded object reader validates byte length and SHA-256, never trusts metadata alone", async () => {
  const storage = fakeStorage();
  const result = await downloadObjectBytes(sourceKey, { maxBytes: 1024, expectedSizeBytes: pdf.length, expectedChecksum: checksum }, storage);
  assert.deepEqual(result.bytes, pdf);
  assert.equal(result.checksum, checksum);
  await assert.rejects(() => downloadObjectBytes(sourceKey, { maxBytes: 4 }, storage), /limit|size/i);
  await assert.rejects(() => downloadObjectBytes(sourceKey, { expectedChecksum: "0".repeat(64) }, storage), /checksum/i);
  await assert.rejects(() => downloadObjectBytes(sourceKey, { expectedSizeBytes: 1 }, storage), /size/i);
  const lying = { bucket: "fake", client: { async send() { return { ContentLength: 1, Body: Readable.from([Buffer.alloc(5), Buffer.alloc(5)]) }; } } };
  await assert.rejects(() => downloadObjectBytes(sourceKey, { maxBytes: 8 }, lying), /limit|size/i);
});

test("snapshot stores verified bytes under a new key and survives source replacement", async () => {
  const storage = fakeStorage();
  const result = await createImmutableSnapshot({ sourceKey, snapshotKey, mimeType: "application/pdf", sizeBytes: pdf.length, checksum }, storage);
  storage.objects.set(sourceKey, Buffer.from("attacker overwrite"));
  assert.equal(result.storageKey, snapshotKey);
  assert.equal(result.checksum, checksum);
  assert.deepEqual(storage.objects.get(snapshotKey), pdf);
  assert.equal(storage.calls.filter(c => c.constructor.name === "PutObjectCommand").length, 1);
  await assert.rejects(() => createImmutableSnapshot({ sourceKey, snapshotKey, mimeType: "application/pdf", sizeBytes: pdf.length, checksum }, storage));
});

test("snapshot verifies destination bytes and does not write spoofed content", async () => {
  const storage = fakeStorage(Buffer.alloc(pdf.length, 65));
  await assert.rejects(() => createImmutableSnapshot({ sourceKey, snapshotKey, mimeType: "application/pdf", sizeBytes: pdf.length }, storage), /signature|content/i);
  assert.equal(storage.calls.some(c => c.constructor.name === "PutObjectCommand"), false);
  const corrupt = fakeStorage();
  const send = corrupt.client.send;
  corrupt.client.send = async command => {
    const result = await send(command);
    if (command.constructor.name === "PutObjectCommand") corrupt.objects.set(snapshotKey, Buffer.alloc(pdf.length));
    return result;
  };
  await assert.rejects(() => createImmutableSnapshot({ sourceKey, snapshotKey, mimeType: "application/pdf", sizeBytes: pdf.length }, corrupt), /checksum/i);
});

test("cleanup defaults to dry-run and preserves consumed, fresh, foreign, and referenced keys", async () => {
  const now = new Date("2026-09-05T12:00:00Z");
  const old = new Date(now.getTime() - 48 * 3600_000);
  const row = { id: "unused", storageKey: sourceKey, expiresAt: old, consumedAt: null };
  const candidates = [row, { ...row, id: "consumed", consumedAt: old }, { ...row, id: "fresh", expiresAt: now },
    { ...row, id: "foreign", storageKey: sourceKey.replace("development", "production") },
    { ...row, id: "version", storageKey: snapshotKey }, { ...row, id: "draft", storageKey: sourceKey.replace("11111111", "33333333") }];
  const deleted = [];
  const refs = new Set([snapshotKey, candidates[5].storageKey]);
  const deps = { async isReferenced(key) { return refs.has(key); }, async deleteObject(key) { deleted.push(key); } };
  const dry = await cleanupUnusedObjects(candidates, { now, environment: "development" }, deps);
  assert.equal(dry.eligible, 1);
  assert.equal(dry.deleted, 0);
  assert.deepEqual(deleted, []);
  const actual = await cleanupUnusedObjects(candidates, { now, environment: "development", dryRun: false }, deps);
  assert.equal(actual.deleted, 1);
  assert.deepEqual(deleted, [sourceKey]);
});

test("cleanup rechecks references before deletion and fails closed on lookup failure", async () => {
  const row = { id: "race", storageKey: snapshotKey, expiresAt: new Date(0), consumedAt: null };
  let reads = 0;
  let deletes = 0;
  const result = await cleanupUnusedObjects([row], { now: new Date(), environment: "development", dryRun: false }, {
    async isReferenced() { return ++reads > 1; }, async deleteObject() { deletes++; },
  });
  assert.equal(result.deleted, 0);
  assert.equal(deletes, 0);
  await assert.rejects(() => cleanupUnusedObjects([row], { now: new Date(), environment: "development", dryRun: false }, {
    async isReferenced() { throw new Error("database unavailable"); }, async deleteObject() { deletes++; },
  }), /database unavailable/);
  assert.equal(deletes, 0);
});
