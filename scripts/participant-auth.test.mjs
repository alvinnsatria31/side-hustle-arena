import assert from "node:assert/strict";
import test, { after } from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";
import { SignJWT } from "jose";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

assert.equal(process.env.APP_ENV, "development", "Participant auth tests require APP_ENV=development");
assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

// The suite owns the secret so it never depends on which value a machine has.
const SECRET = "test-session-secret-do-not-use-anywhere-else";
process.env.SESSION_SECRET = SECRET;

const tokenApi = await import("../src/server/auth/participant-token.ts");
const sessionApi = await import("../src/server/auth/participant-provision.ts");
const avatarApi = await import("../src/server/auth/avatar.ts");
const { AVATARS, isValidAvatarId } = await import("../src/lib/avatars.ts");

const stamp = Date.now();
const PARTICIPANT_ID = `p-${stamp}`;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

after(async () => {
  await sql`delete from identity.users where auth_subject like ${"sk-participant:p-%"}`;
  await sql.end({ timeout: 5 });
});

const claims = {
  sub: PARTICIPANT_ID,
  email: "peserta@example.test",
  username: "peserta",
  firstName: "Peserta",
};

async function mint(overrides = {}, { secret = SECRET, expiresIn = "30d", alg = "HS256" } = {}) {
  return new SignJWT({ ...claims, ...overrides })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

test("a genuine Sekolah Karir token is accepted and its claims are read", async () => {
  const verified = await tokenApi.verifyParticipantToken(await mint());
  assert.deepEqual(verified, claims);
  assert.equal(tokenApi.arenaSubjectFor(verified), `sk-participant:${PARTICIPANT_ID}`);
});

test("forged, stale, and malformed tokens all read as signed out", async () => {
  // Every one of these is something a visitor could plausibly present, so the
  // honest answer is "not signed in" — never an exception, never a partial user.
  assert.equal(await tokenApi.verifyParticipantToken(undefined), null);
  assert.equal(await tokenApi.verifyParticipantToken(""), null);
  assert.equal(await tokenApi.verifyParticipantToken("not-a-jwt"), null);

  // Signed with the wrong secret: the classic forgery.
  assert.equal(await tokenApi.verifyParticipantToken(await mint({}, { secret: "some-other-secret" })), null);

  // Expired 30-day session.
  assert.equal(await tokenApi.verifyParticipantToken(await mint({}, { expiresIn: "-1h" })), null);

  // Tampered payload: same header and signature, different claims.
  const good = await mint();
  const [header, , signature] = good.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ ...claims, sub: "someone-else" })).toString("base64url");
  assert.equal(await tokenApi.verifyParticipantToken(`${header}.${forgedPayload}.${signature}`), null);

  // Claims the main site always sends; a token missing one is not a session.
  for (const missing of ["sub", "email", "username", "firstName"]) {
    const partial = { ...claims };
    delete partial[missing];
    const token = await new SignJWT(partial)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(new TextEncoder().encode(SECRET));
    assert.equal(await tokenApi.verifyParticipantToken(token), null, `${missing} must be required`);
  }
});

test("the algorithm is pinned, so an unsigned token cannot walk in", async () => {
  // "alg: none" with an empty signature is the oldest JWT forgery there is.
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  assert.equal(await tokenApi.verifyParticipantToken(`${header}.${payload}.`), null);

  // A token that announces a different family must not be checked against the
  // shared secret either.
  const hs512 = await mint({}, { alg: "HS512" });
  assert.equal(await tokenApi.verifyParticipantToken(hs512), null);
});

test("a missing SESSION_SECRET fails loudly instead of logging everyone out", async () => {
  const saved = process.env.SESSION_SECRET;
  try {
    delete process.env.SESSION_SECRET;
    await assert.rejects(
      tokenApi.verifyParticipantToken(await mint({}, { secret: saved })),
      (error) => error.name === "ParticipantSecretMissingError",
    );
  } finally {
    process.env.SESSION_SECRET = saved;
  }
});

test("the Arena mirrors the participant once, follows profile changes, and honours a suspension", async () => {
  const first = await sessionApi.provisionParticipant(claims);
  assert.ok(first?.id, "a signed-in participant must resolve to an Arena user");
  assert.equal(first.authSubject, `sk-participant:${PARTICIPANT_ID}`);
  assert.equal(first.email, claims.email);
  assert.equal(first.displayName, "Peserta");

  // Same participant signing in again is the same Arena row: submissions and
  // points must not fork when someone opens a second tab.
  const second = await sessionApi.provisionParticipant(claims);
  assert.equal(second.id, first.id);
  const rows = await sql`select count(*)::int as n from identity.users where auth_subject = ${`sk-participant:${PARTICIPANT_ID}`}`;
  assert.equal(rows[0].n, 1);

  // Renaming or changing email on the main site follows through, and the key
  // stays put because it is the participant id, not the email.
  const renamed = await sessionApi.provisionParticipant({ ...claims, email: "baru@example.test", firstName: "Peserta Baru" });
  assert.equal(renamed.id, first.id);
  assert.equal(renamed.email, "baru@example.test");
  assert.equal(renamed.displayName, "Peserta Baru");

  // The Arena can bar someone from the competition without touching their
  // Sekolah Karir login: a valid session still resolves to nobody here.
  await sql`update identity.users set status = 'SUSPENDED' where id = ${first.id}`;
  assert.equal(await sessionApi.provisionParticipant(claims), null);
  await sql`update identity.users set status = 'ACTIVE' where id = ${first.id}`;
});

test("a freshly mirrored participant has no avatar, which is what raises the picker", async () => {
  await sql`delete from identity.users where auth_subject = ${`sk-participant:${PARTICIPANT_ID}`}`;
  const fresh = await sessionApi.provisionParticipant(claims);
  // Null, not the default: the app reads this to decide whether to ask, so
  // defaulting the column here would silently skip the one step on arrival.
  assert.equal(fresh.avatarId, null);
});

test("a picked avatar is stored, read back, and survives an ordinary sign-in", async () => {
  const user = await sessionApi.provisionParticipant(claims);
  const picked = AVATARS[3].id;
  assert.ok(isValidAvatarId(picked));
  assert.equal(await avatarApi.setParticipantAvatar(user.id, picked), true);
  assert.equal((await sessionApi.provisionParticipant(claims)).avatarId, picked);

  // Signing in rewrites the mirrored profile whenever it drifted. That write
  // must not take the avatar with it — the picker would reappear on the next
  // rename, asking again for something already answered.
  const renamed = await sessionApi.provisionParticipant({ ...claims, firstName: "Peserta Ganti" });
  assert.equal(renamed.avatarId, picked);
  assert.equal(renamed.displayName, "Peserta Ganti");
});

test("an avatar outside the catalogue is refused and leaves the stored one alone", async () => {
  const user = await sessionApi.provisionParticipant(claims);
  const picked = AVATARS[5].id;
  assert.equal(await avatarApi.setParticipantAvatar(user.id, picked), true);

  // This column is rendered straight into every surface that lists people, so
  // an id no preset matches would blank an identity for everyone looking at it.
  for (const bad of ["", "not-an-avatar", "ROCKET", "../rocket", "<script>"]) {
    assert.equal(await avatarApi.setParticipantAvatar(user.id, bad), false, `${bad} must be refused`);
  }
  assert.equal((await sessionApi.provisionParticipant(claims)).avatarId, picked);
});

test("picking an avatar for a user who is not there fails instead of writing nothing quietly", async () => {
  const missing = "00000000-0000-4000-8000-000000000000";
  assert.equal(await avatarApi.setParticipantAvatar(missing, AVATARS[0].id), false);
});
