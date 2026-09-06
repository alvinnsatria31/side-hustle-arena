// TEMPORARY: apply drizzle migrations to the PRODUCTION database.
//
// scripts/db-migrate.mjs deliberately refuses to run unless APP_ENV is
// development/test — a guard against migrating production by accident from a
// dev machine. Rather than weaken that guard, this is a separate, explicit
// production path that demands its own flag and its own env var name.
//
// Only ever creates schema; it never drops or truncates anything.
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { resolve } from "node:path";

if (!process.argv.includes("--i-mean-production")) {
  throw new Error("Refusing to run without --i-mean-production.");
}
const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error("PROD_DATABASE_URL is required.");

const client = postgres(url, { max: 1 });
try {
  await migrate(drizzle({ client }), { migrationsFolder: resolve(process.cwd(), "drizzle") });
  const schemas = await client`select schema_name from information_schema.schemata
    where schema_name in ('arena','identity','rewards','notifications','audit','automation','ops')
    order by schema_name`;
  const tables = await client`select count(*)::int as n from information_schema.tables
    where table_schema in ('arena','identity','rewards','notifications','audit','automation','ops')`;
  const applied = await client`select count(*)::int as n from drizzle.__drizzle_migrations`;
  console.log("schemas :", schemas.map((s) => s.schema_name).join(", "));
  console.log("tables  :", tables[0].n);
  console.log("applied :", applied[0].n, "migrations");
} finally {
  await client.end({ timeout: 5 });
}
