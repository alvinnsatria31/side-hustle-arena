import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const j = await sql`select id, status, attempt_count, locked_by, lease_expires_at, last_error_code, last_error_message
    from arena.review_jobs order by created_at desc limit 2`;
  console.log("REVIEW JOBS:", JSON.stringify(j, null, 1));
  const r = await sql`select id, status, created_at from arena.reviews order by created_at desc limit 3`;
  console.log("REVIEWS:", JSON.stringify(r));
  const [sc] = await sql`select count(*)::int n from arena.review_scores`;
  console.log("review_scores:", sc.n);
} catch (e) { console.log("FAILED:", e.message); }
finally { await sql.end({ timeout: 5 }); }
