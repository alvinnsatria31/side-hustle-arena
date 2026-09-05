import path from "node:path";
import { test as base } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { connect, resetEnrollment } from "./fixture-db";

loadEnvConfig(process.cwd());

type Fixtures = {
  /** Absolute path to a generated upload artifact. */
  artifact: (name: string) => string;
};

type WorkerFixtures = {
  db: ReturnType<typeof connect>;
  /** Puts the fixture user back to "enrolled in nothing" for each worker. */
  freshEnrollment: void;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  db: [
    async ({}, use) => {
      const sql = connect();
      await use(sql);
      await sql.end({ timeout: 5 });
    },
    { scope: "worker" },
  ],

  freshEnrollment: [
    async ({ db }, use) => {
      await resetEnrollment(db);
      await use();
    },
    { scope: "worker", auto: true },
  ],

  artifact: async ({}, use) => {
    await use((name: string) => path.join(process.cwd(), "e2e", ".artifacts", name));
  },
});

export { expect } from "@playwright/test";
