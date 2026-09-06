import postgres from "postgres";
const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error("PROD_DATABASE_URL missing");
const sql = postgres(url, { max: 1 });
const [v] = await sql`select version()`;
console.log("CONNECTED:", v.version.split(",")[0]);
const schemas = await sql`select schema_name from information_schema.schemata
  where schema_name in ('arena','identity','rewards','notifications','audit','automation','ops')`;
console.log("app schemas present:", schemas.length, schemas.map(s => s.schema_name).join(",") || "(none — empty)");
await sql.end({ timeout: 5 });
