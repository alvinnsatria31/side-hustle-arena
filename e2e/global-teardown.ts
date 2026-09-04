import { rmSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { connect, teardownFixture } from "./fixture-db";

export default async function globalTeardown() {
  loadEnvConfig(process.cwd());
  const sql = connect();
  try {
    await teardownFixture(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
  rmSync(path.join(process.cwd(), "e2e", ".auth"), { recursive: true, force: true });
  rmSync(path.join(process.cwd(), "e2e", ".artifacts"), { recursive: true, force: true });
}
