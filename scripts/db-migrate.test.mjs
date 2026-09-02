import assert from "node:assert/strict";
import test from "node:test";

test("rejects migration targets outside development or test", async () => {
  const { assertDatabaseEnvironment } = await import("./db-migrate.mjs");

  assert.throws(() => assertDatabaseEnvironment(undefined), /development or test/i);
  assert.throws(() => assertDatabaseEnvironment("production"), /development or test/i);
  assert.doesNotThrow(() => assertDatabaseEnvironment("development"));
  assert.doesNotThrow(() => assertDatabaseEnvironment("test"));
});
