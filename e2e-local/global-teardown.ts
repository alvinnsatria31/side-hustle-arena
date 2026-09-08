import { rmSync } from "node:fs";
import path from "node:path";
import { localEnvironment } from "../scripts/local-env.mjs";
import { connect, teardownFixture } from "./fixtures";

/** Leaves the sandbox as it was found, whether the run passed or failed. */
export default async function globalTeardown() {
  const env = localEnvironment();
  for (const [key, value] of Object.entries(env)) process.env[key] = String(value);
  const sql = connect();
  try {
    await teardownFixture(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
  rmSync(path.join(process.cwd(), "e2e-local", ".auth"), { recursive: true, force: true });
}
