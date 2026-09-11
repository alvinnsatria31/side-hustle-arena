import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const r = await sql`select v.id vid, v.review_status, v.explanation, v.notes, v.created_at,
      s.id sid, u.auth_subject, u.display_name_cache, p.title, w.week_code
    from arena.submission_versions v
    join arena.submissions s on s.id = v.submission_id
    join identity.users u on u.id = s.user_id
    left join arena.projects p on p.id = s.project_id
    left join arena.weeks w on w.id = s.week_id
    order by v.created_at`;
  for (const x of r) {
    console.log(`\nversion ${String(x.vid).slice(0,8)}  ${x.review_status}  ${x.created_at.toISOString()}`);
    console.log(`  user    ${x.auth_subject}  (${x.display_name_cache})`);
    console.log(`  proyek  ${x.title}  ·  ${x.week_code}`);
    console.log(`  expl    ${String(x.explanation).slice(0,110)}`);
    console.log(`  notes   ${String(x.notes).slice(0,80)}`);
  }
  const j = await sql`select id, submission_version_id, status, attempt_count from arena.review_jobs`;
  console.log("\njobs:", JSON.stringify(j));
} catch (e) { console.log("FAILED:", e.message); }
finally { await sql.end({ timeout: 5 }); }
