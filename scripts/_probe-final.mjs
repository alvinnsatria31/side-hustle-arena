import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const n = async (s,t) => { try { const [r]=await sql`select count(*)::int n from ${sql(s)}.${sql(t)}`; return r.n; } catch(e){ return "ERR"; } };
try {
  const [w] = await sql`select week_code, status from arena.weeks where id='c26c0f88-18e9-4afa-8e4c-d8504ce5c0ae'`;
  console.log("WEEK:", JSON.stringify(w));
  const r = await sql`select * from arena.weekly_rankings`;
  console.log("\nRANKINGS:", JSON.stringify(r, null, 1));
  console.log("\npoint_accounts:", await n("rewards","point_accounts"), "| point_ledger:", await n("rewards","point_ledger"));
  const led = await sql`select * from rewards.point_ledger`.catch(()=>[]);
  if (led.length) console.log("LEDGER:", JSON.stringify(led, null, 1));
  const [rev] = await sql`select status, final_score, published_at from arena.reviews order by created_at desc limit 1`;
  console.log("\nREVIEW:", JSON.stringify(rev));
  console.log("skill_evidence:", await n("arena","skill_evidence"), "| deliveries:", await n("notifications","deliveries"), "| events:", await n("notifications","events"));
} catch (e) { console.log("FAILED:", e.message); }
finally { await sql.end({ timeout: 5 }); }
