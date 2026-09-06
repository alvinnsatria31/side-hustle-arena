// TEMPORARY, read-only: confirm the production schema is actually in place.
import postgres from "postgres";

const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error("PROD_DATABASE_URL is required.");
const sql = postgres(url, { max: 1 });
try {
  const schemas = await sql`select schema_name from information_schema.schemata
    where schema_name in ('arena','identity','rewards','notifications','audit','automation','ops')
    order by schema_name`;
  const tables = await sql`select table_schema, count(*)::int as n from information_schema.tables
    where table_schema in ('arena','identity','rewards','notifications','audit','automation','ops')
    group by table_schema order by table_schema`;
  const applied = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;

  console.log("schemas  :", schemas.map((s) => s.schema_name).join(", ") || "(none)");
  console.log("tables   :", tables.map((t) => `${t.table_schema}=${t.n}`).join("  "));
  console.log("migrations applied:", applied[0].n);

  // The two migrations the handoff flagged as never having reached production.
  const artifacts = await sql`select to_regclass('arena.review_artifacts') as t`;
  const outbox = await sql`select to_regclass('notifications.deliveries') as t`;
  console.log("0007 review_artifacts   :", artifacts[0].t ?? "MISSING");
  console.log("0008 notification outbox:", outbox[0].t ?? "MISSING");

  const rewards = await sql`select count(*)::int as n from rewards.catalog`;
  console.log("reward catalog rows     :", rewards[0].n, rewards[0].n === 0 ? "(needs db:seed:rewards)" : "");
} finally {
  await sql.end({ timeout: 5 });
}
