// A01 regression: the bytes a reviewer grades are the bytes that were submitted.
//
// The attack these tests describe is not exotic. A presigned PUT is valid for
// its whole TTL, so anyone holding one can replace the draft object after the
// submit button is pressed. Pick a replacement of the same length and every
// size-based check still passes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import {
  assertArtifactIdentity,
  planVersionSnapshots,
  resolveVersionItemStorage,
} from "../src/server/submissions/version-core.ts";
import { createImmutableSnapshot, downloadObjectBytes } from "../src/server/storage/integrity.ts";
import { cleanupUnusedObjects } from "../src/server/storage/cleanup-core.ts";

const submitted = Buffer.from("%PDF-1.7\nsubmitted work\nendobj\n%%EOF\n");
// Same length, different bytes: the whole point of the regression.
const swapped = Buffer.from(submitted);
swapped.write("SWAPPED w", 9);
assert.equal(swapped.length, submitted.length);
assert.notDeepEqual(swapped, submitted);

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const draftKey = "arena/development/11111111-1111-4111-8111-111111111111";
const snapshotKey = "arena/development/snapshots/22222222-2222-4222-8222-222222222222";

function fakeStorage(initial = submitted) {
  const objects = new Map([[draftKey, Buffer.from(initial)]]);
  return {
    objects,
    bucket: "fixture",
    client: {
      async send(command) {
        const { Key, Body } = command.input;
        if (command.constructor.name === "GetObjectCommand") {
          const bytes = objects.get(Key);
          if (!bytes) throw new Error("Missing object");
          return { Body: Readable.from([bytes]), ContentLength: bytes.length, ContentType: "application/pdf" };
        }
        if (command.constructor.name === "PutObjectCommand") {
          if (command.input.IfNoneMatch === "*" && objects.has(Key)) throw new Error("PreconditionFailed");
          objects.set(Key, Buffer.from(Body));
          return {};
        }
        throw new Error(`Unexpected command ${command.constructor.name}`);
      },
    },
  };
}

test("only draft FILE items are planned for freezing", () => {
  const items = [
    { id: "file", itemType: "FILE", storageKey: draftKey, mimeType: "application/pdf", fileSizeBytes: 10, checksum: null },
    { id: "link", itemType: "LINK", storageKey: null, mimeType: null, fileSizeBytes: null, checksum: null },
    { id: "empty", itemType: "FILE", storageKey: null, mimeType: null, fileSizeBytes: null, checksum: null },
  ];
  assert.deepEqual(planVersionSnapshots(items).map((item) => item.id), ["file"]);
});

test("a version item never inherits the overwritable draft key, and refuses to guess", () => {
  const item = { id: "file", itemType: "FILE", storageKey: draftKey, mimeType: "application/pdf", fileSizeBytes: submitted.length, checksum: sha(submitted) };
  const frozen = { storageKey: snapshotKey, checksum: sha(submitted), sizeBytes: submitted.length };
  const resolved = resolveVersionItemStorage(item, new Map([["file", frozen]]));
  assert.equal(resolved.storageKey, snapshotKey);
  assert.equal(resolved.checksum, frozen.checksum);
  assert.notEqual(resolved.storageKey, draftKey);

  // No snapshot must be a hard failure, never a fall-through to the draft key.
  assert.throws(() => resolveVersionItemStorage(item, new Map()), /frozen/i);
  assert.throws(
    () => resolveVersionItemStorage(item, new Map([["file", { ...frozen, storageKey: draftKey }]])),
    /draft object key/i,
  );
  // Links carry no object reference at all.
  const link = { id: "link", itemType: "LINK", storageKey: null, mimeType: null, fileSizeBytes: null, checksum: null };
  assert.equal(resolveVersionItemStorage(link, new Map()).storageKey, null);
});

test("artifact identity rejects an equal-size replacement and unverifiable rows", () => {
  const expected = { storageKey: snapshotKey, checksum: sha(submitted), fileSizeBytes: submitted.length };
  assert.doesNotThrow(() => assertArtifactIdentity(expected, { checksum: sha(submitted), sizeBytes: submitted.length }));
  assert.throws(
    () => assertArtifactIdentity(expected, { checksum: sha(swapped), sizeBytes: swapped.length }),
    /content changed/i,
  );
  assert.throws(() => assertArtifactIdentity(expected, { checksum: sha(submitted), sizeBytes: 4 }), /size changed/i);
  assert.throws(
    () => assertArtifactIdentity({ ...expected, checksum: null }, { checksum: sha(submitted), sizeBytes: submitted.length }),
    /no recorded checksum/i,
  );
});

test("a replayed presigned PUT cannot change what the reviewer reads", async () => {
  const storage = fakeStorage();
  const checksum = sha(submitted);
  const frozen = await createImmutableSnapshot(
    { sourceKey: draftKey, snapshotKey, mimeType: "application/pdf", sizeBytes: submitted.length, checksum },
    storage,
  );

  // The attacker replays the still-valid presigned PUT on the draft key.
  storage.objects.set(draftKey, Buffer.from(swapped));

  const read = await downloadObjectBytes(frozen.storageKey, {
    expectedSizeBytes: frozen.sizeBytes,
    expectedChecksum: frozen.checksum,
  }, storage);
  assert.deepEqual(read.bytes, submitted);
  assert.doesNotThrow(() => assertArtifactIdentity(
    { storageKey: frozen.storageKey, checksum: frozen.checksum, fileSizeBytes: frozen.sizeBytes },
    read,
  ));

  // And the snapshot key itself is write-once: a second freeze onto it fails.
  await assert.rejects(() => createImmutableSnapshot(
    { sourceKey: draftKey, snapshotKey, mimeType: "application/pdf", sizeBytes: swapped.length, checksum: sha(swapped) },
    storage,
  ));
});

test("freezing refuses a draft whose bytes changed between finalize and submit", async () => {
  const storage = fakeStorage();
  const finalizedChecksum = sha(submitted);
  storage.objects.set(draftKey, Buffer.from(swapped));
  await assert.rejects(
    () => createImmutableSnapshot(
      { sourceKey: draftKey, snapshotKey, mimeType: "application/pdf", sizeBytes: submitted.length, checksum: finalizedChecksum },
      storage,
    ),
    /checksum/i,
  );
  assert.equal(storage.objects.has(snapshotKey), false);
});

test("cleanup now reclaims a consumed intent whose draft item is gone", async () => {
  const now = new Date("2026-09-08T12:00:00Z");
  const expired = new Date(now.getTime() - 48 * 3600_000);
  const deleted = [];
  const referenced = new Set([snapshotKey]);
  const result = await cleanupUnusedObjects(
    [
      { id: "orphan", storageKey: draftKey, expiresAt: expired, consumedAt: expired },
      { id: "still-referenced", storageKey: snapshotKey, expiresAt: expired, consumedAt: expired },
    ],
    { now, environment: "development", dryRun: false },
    { async isReferenced(key) { return referenced.has(key); }, async deleteObject(key) { deleted.push(key); } },
  );
  assert.deepEqual(deleted, [draftKey]);
  assert.equal(result.deleted, 1);
  assert.equal(result.skipped, 1);
});
