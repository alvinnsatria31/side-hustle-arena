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
    database = drizzle({ client: postgres(result.data, { max: 1 }), schema });
  }

  return database;
}
