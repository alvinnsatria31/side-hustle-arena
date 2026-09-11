// The probe's LINK item pointed at example.invalid, which cannot resolve, so
// ensureReviewSources threw while fetching it and Arena failed the job with
// ARTIFACT_EXTRACTION_FAILED before the worker ever received it. That is the
// pipeline behaving correctly — it refuses to grade an artifact it cannot read.
//
// Point the item at a reachable URL instead, so the LINK extraction path is
// exercised for real rather than skipped, and hand the job back to the queue
// with a clean attempt count.
import postgres from "postgres";

const VERSION_ID = "2b34136b-101c-4b7f-af31-07aad252b5e7";
const JOB_ID = "768ae895-0eef-404e-b031-f104fe7acb0b";
const REACHABLE = "https://example.com";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const apply = process.argv.includes("--apply");

try {
  const before = await sql`select id, status, attempt_count, last_error_code from arena.review_jobs where id = ${JOB_ID}`;
  console.log("sebelum:", JSON.stringify(before[0]));

  if (!apply) {
    console.log("\n(dry run — jalankan dengan --apply)");
  } else {
    await sql.begin(async (tx) => {
      await tx`update arena.submission_version_items
        set external_url = ${REACHABLE}
        where submission_version_id = ${VERSION_ID} and item_type = 'LINK'`;
      // Any half-written artifact rows from the failed attempt would be reused
      // by ensureReviewSources and mask the retry, so clear them first.
      await tx`delete from arena.review_artifacts where submission_version_id = ${VERSION_ID}`;
      await tx`update arena.review_jobs
        set status = 'PENDING', attempt_count = 0, available_at = now(),
            locked_at = null, locked_by = null, lease_expires_at = null,
            last_error_code = null, last_error_message = null, updated_at = now()
        where id = ${JOB_ID}`;
      await tx`update arena.submission_versions set review_status = 'QUEUED' where id = ${VERSION_ID}`;
    });
    const after = await sql`select status, attempt_count, last_error_code from arena.review_jobs where id = ${JOB_ID}`;
    console.log("sesudah:", JSON.stringify(after[0]));
    console.log("link  :", REACHABLE);
  }
} catch (error) {
  console.log("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
