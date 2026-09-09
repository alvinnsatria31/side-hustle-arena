/**
 * Drizzle migration runner for the self-hosted database.
 *
 * `npm run db:migrate` cannot be used on the box: it loads .env through
 * @next/env and refuses any APP_ENV other than development/test, and the
 * runtime image carries neither the migration files nor drizzle-kit. This is
 * the same migrator with the environment supplied directly by the container.
 *
 * Run through the `sk-arena-migrate` service in docker-compose.arena.yml,
 * which passes LOCAL_DATABASE_URL from arena.env. See
 * docs/backend/DEPLOY_SK_VPS.md.
 */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must be set.");

const url = new URL(databaseUrl);
if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
  throw new Error("DATABASE_URL must use a PostgreSQL protocol.");
}

const client = postgres(databaseUrl, { max: 1 });
try {
  await migrate(drizzle({ client }), { migrationsFolder: "/work/drizzle" });
  console.log("MIGRATE_OK");
} finally {
  await client.end({ timeout: 5 });
}
