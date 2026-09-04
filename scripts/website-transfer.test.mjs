import assert from "node:assert/strict";
import test from "node:test";

const avatars = await import("../src/lib/avatars.ts");
const usernames = await import("../src/lib/usernames.ts");
const format = await import("../src/lib/format.ts");
const flags = await import("../src/server/ops/feature-flags-core.ts");

test("avatar catalogue resolves known ids and degrades unknown ids to the default", () => {
  assert.equal(avatars.avatarFor("fire").emoji, "🔥");
  assert.equal(avatars.avatarFor("retired-id").id, avatars.DEFAULT_AVATAR_ID);
  assert.equal(avatars.avatarFor(null).id, avatars.DEFAULT_AVATAR_ID);
  assert.equal(avatars.avatarFor(undefined).id, avatars.DEFAULT_AVATAR_ID);
  assert.equal(avatars.isValidAvatarId("crown"), true);
  assert.equal(avatars.isValidAvatarId("nope"), false);
  assert.equal(new Set(avatars.AVATARS.map((a) => a.id)).size, avatars.AVATARS.length);
});

test("username guard accepts clean handles and rejects shape, reserved, and profanity violations", () => {
  assert.deepEqual(usernames.checkUsername("Budi_Santoso99"), { ok: true, username: "budisantoso99" });
  assert.equal(usernames.checkUsername("ab").ok, false);
  assert.equal(usernames.checkUsername("x".repeat(21)).ok, false);
  assert.equal(usernames.checkUsername("123456").ok, false);
  assert.equal(usernames.checkUsername("Admin").ok, false);
  assert.equal(usernames.checkUsername("arena").ok, false);
  assert.equal(usernames.checkUsername("budi_goblok99").ok, false);
  assert.equal(usernames.normalizeUsername("Budi Santoso!"), "budisantoso");
});

test("username rename cooldown is free for first-timers and counts down afterwards", () => {
  assert.equal(usernames.renameCooldownRemaining(null), 0);
  const changedAt = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(usernames.renameCooldownRemaining(changedAt, new Date("2026-09-10T00:00:00.000Z")), 0);
  const remaining = usernames.renameCooldownRemaining(changedAt, new Date("2026-09-02T00:00:00.000Z"));
  assert.ok(remaining > 0 && remaining <= usernames.USERNAME_RENAME_COOLDOWN_MS);
  assert.match(usernames.formatCooldown(3 * 24 * 60 * 60 * 1000), /hari lagi/);
  assert.match(usernames.formatCooldown(5 * 60 * 60 * 1000), /jam lagi/);
});

test("transferred formatters render rupiah and relative timestamps in id-ID", () => {
  assert.equal(format.formatRupiah(99000), "Rp 99.000");
  assert.equal(format.formatRupiah(500000), "Rp 500.000");
  assert.equal(format.formatPostedAt(new Date().toISOString()), "Hari ini");
  assert.equal(format.formatPostedAt(new Date(Date.now() - 3 * 86_400_000).toISOString()), "3 hari lalu");
});

test("the feature-flag server wrapper stays explicitly server-only", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/server/ops/feature-flags.ts", import.meta.url), "utf8"));
  assert.match(source, /import\s+["']server-only["']/);
});

test("feature flag resolver defaults open on missing rows and honors closed rows", () => {
  assert.deepEqual(flags.resolveArenaFeatureState([], "arena-submissions"), { closed: false, message: null });
  assert.deepEqual(
    flags.resolveArenaFeatureState([{ key: "arena-submissions", maintenanceMode: false, message: "x" }], "arena-submissions"),
    { closed: false, message: null },
  );
  assert.deepEqual(
    flags.resolveArenaFeatureState([{ key: "arena-submissions", maintenanceMode: true, message: "Perbaikan" }], "arena-submissions"),
    { closed: true, message: "Perbaikan" },
  );
  // Other keys are unaffected by a sibling closure.
  assert.deepEqual(
    flags.resolveArenaFeatureState([{ key: "arena-submissions", maintenanceMode: true, message: null }], "arena-enrollment"),
    { closed: false, message: null },
  );
  assert.equal(flags.featureLabel("arena-publish"), "Weekly publish");
  assert.deepEqual(flags.ARENA_FEATURES.map((f) => f.key), ["arena-enrollment", "arena-submissions", "arena-publish", "rewards-redemption"]);
});
