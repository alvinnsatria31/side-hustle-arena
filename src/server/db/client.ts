import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

let database: Database | undefined;

export function getDb(): Database {
  const result = z.string().url().safeParse(process.env.DATABASE_URL);

  if (!result.success) {
    throw new Error("DATABASE_URL must be set before using the database.");
  }

  if (!database) {
    // Pool size follows the deployment shape. `max: 1` was right on Vercel:
    // every request ran in its own short-lived function instance, so a larger
    // pool per instance bought nothing and multiplied connections against the
    // provider's cap. Self-hosted, this is ONE long-lived process serving every
    // request, and a pool of one serialises them all behind a single
    // connection — each query waits out every query before it. Ten is sized
    // against the local `max_connections=50` in
    // deploy/sk-vps/docker-compose.arena.yml, leaving room for migrations,
    // backups and psql.
    database = drizzle({ client: postgres(result.data, { max: 10 }), schema });
  }

  return database;
}
