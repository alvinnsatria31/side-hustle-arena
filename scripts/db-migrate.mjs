import nextEnv from "@next/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { loadEnvConfig } = nextEnv;

export function assertDatabaseEnvironment(value) {
  if (value !== "development" && value !== "test") {
    throw new Error("APP_ENV must be development or test before migrations run.");
  }
}

export async function migrateArenaDatabase() {
  loadEnvConfig(process.cwd());
  assertDatabaseEnvironment(process.env.APP_ENV);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before migrations run.");
  }

  const url = new URL(databaseUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use a PostgreSQL protocol.");
  }

  const client = postgres(databaseUrl, { max: 1 });

  try {
    await migrate(drizzle({ client }), {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateArenaDatabase()
    .then(() => console.log("Arena development migrations complete."))
    .catch(() => {
      console.error("Arena migration failed without printing database credentials.");
      process.exit(1);
    });
}
