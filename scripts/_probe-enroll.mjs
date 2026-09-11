import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const cols = async (s, t) => {
  const r = await sql`select column_name c, is_nullable n, column_default d from information_schema.columns
    where table_schema=${s} and table_name=${t} order by ordinal_position`;
  return r.map(x => `${x.c}${x.n === 'NO' && !x.d ? '*' : ''}`).join(", ");
};
try {
  console.log("users        :", await cols("identity", "users"));
  console.log("review_jobs  :", await cols("arena", "review_jobs"));
  const w = await sql`select id, week_code, status from arena.weeks where status='OPEN'`;
  console.log("\nOPEN week:", JSON.stringify(w));
  const p = await sql`select id, title, slug, week_id from arena.projects where status='PUBLISHED' and week_id = ${w[0].id}`;
  console.log("projects minggu itu:", JSON.stringify(p.map(x => ({ t: x.title, id: x.id }))));
  const req = await sql`select id, label, type from arena.project_submission_requirements where project_id = ${p[0].id}`.catch(e => e.message);
  console.log("requirements proyek pertama:", JSON.stringify(req));
} catch (e) { console.log("FAILED:", e.message); }
finally { await sql.end({ timeout: 5 }); }
