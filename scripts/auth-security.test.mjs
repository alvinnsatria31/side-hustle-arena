import assert from "node:assert/strict";
import test from "node:test";

const crypto = await import("../src/server/auth/crypto.ts");
const pkce = await import("../src/server/auth/pkce.ts");
const paths = await import("../src/server/auth/return-path.ts");
const expiry = await import("../src/server/auth/expiry.ts");

test("generates opaque session credentials and hashes them before storage", () => {
  const first = crypto.generateOpaqueToken();
  const second = crypto.generateOpaqueToken();

  assert.equal(first.length >= 43, true);
  assert.notEqual(first, second);
  assert.equal(crypto.hashOpaqueToken(first).length, 64);
  assert.notEqual(crypto.hashOpaqueToken(first), first);
});

test("requires the RFC S256 PKCE verifier", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

  assert.equal(pkce.toS256Challenge(verifier), challenge);
  assert.equal(pkce.verifyPkce(verifier, challenge), true);
  assert.equal(pkce.verifyPkce("wrong-verifier", challenge), false);
});

test("rejects missing and wrong SSO state", () => {
  assert.equal(crypto.matchesState("expected-state", "expected-state"), true);
  assert.equal(crypto.matchesState("expected-state", "wrong-state"), false);
  assert.equal(crypto.matchesState("expected-state", null), false);
});

test("accepts only safe internal Arena return paths", () => {
  assert.equal(paths.sanitizeInternalReturnPath("/app/arena/projects/x"), "/app/arena/projects/x");
  assert.equal(paths.sanitizeInternalReturnPath("https://evil.example"), "/app");
  assert.equal(paths.sanitizeInternalReturnPath("//evil.example"), "/app");
  assert.equal(paths.sanitizeInternalReturnPath("javascript:alert(1)"), "/app");
  assert.equal(paths.sanitizeInternalReturnPath("\\\\evil.example"), "/app");
});

test("never lets an Arena session outlive its canonical grant", () => {
  const now = new Date("2026-09-02T00:00:00.000Z");
  assert.equal(
    expiry.getArenaSessionExpiry(new Date("2026-09-02T00:01:00.000Z"), now).toISOString(),
    "2026-09-02T00:01:00.000Z",
  );
});
