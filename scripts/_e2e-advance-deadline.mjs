// Move the open week's deadline into the past so the real scheduler can close
// it. Nothing about the close/finalize logic is bypassed — runWeekClose still
// applies its own guards, and runWeekFinalize still refuses while any review
// job is open. The only thing simulated here is the passage of time.
//
// Using the scheduler rather than the admin force-close is deliberate: it also
// proves the hourly close/finalize cadence works on real data, which is the
// fix made earlier today.
import postgres from "postgres";

const WEEK_ID = "c26c0f88-18e9-4afa-8e4c-d8504ce5c0ae"; // ADHOC-2026-09-08-7543

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const apply = process.argv.includes("--apply");

try {
  const [before] = await sql`
    select week_code, status, submission_deadline_at, opens_at from arena.weeks where id = ${WEEK_ID}`;
  console.log("sebelum:", JSON.stringify(before));

  const open = await sql`
    select j.status, count(*)::int n from arena.review_jobs j
    join arena.submission_versions v on v.id = j.submission_version_id
    join arena.submissions s on s.id = v.submission_id
    where s.week_id = ${WEEK_ID} group by j.status`;
  console.log("review jobs minggu ini:", JSON.stringify(open));

  if (!apply) {
    console.log("\n(dry run — jalankan dengan --apply)");
  } else {
    await sql`update arena.weeks
      set submission_deadline_at = now() - interval '2 minutes', updated_at = now()
      where id = ${WEEK_ID}`;
    const [after] = await sql`
      select week_code, status, submission_deadline_at from arena.weeks where id = ${WEEK_ID}`;
    console.log("sesudah:", JSON.stringify(after));
    console.log("\nMinggu ini sekarang lewat deadline. Tick week-close berikutnya akan menutupnya.");
  }
} catch (error) {
  console.log("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
