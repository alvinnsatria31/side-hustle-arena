/**
 * Register the local fixture jobs source, so the Jobs pipeline can be run,
 * looked at and demonstrated with no vendor and no credential.
 *
 * Refuses to run anywhere but the local sandbox — twice over. This script
 * checks the environment, and the adapter it registers checks again at fetch
 * time, because "invented openings displayed as live listings" is the single
 * most damaging thing this product could do and one guard is not enough.
 *
 *   node scripts/seed-jobs-fixture.mjs            register (idempotent)
 *   node scripts/seed-jobs-fixture.mjs --remove   deregister and delete its openings
 */
import postgres from "postgres";
import { localEnvironment } from "./local-env.mjs";

const env = localEnvironment();
for (const [key, value] of Object.entries(env)) process.env[key] = value;

const { isLocalSandboxEnvironment } = await import("../src/server/dev/guard.ts");
if (!isLocalSandboxEnvironment(process.env)) {
  throw new Error("The jobs fixture source may only be registered in the local sandbox.");
}

const SLUG = "local-fixture";
const config = {
  file: "scripts/fixtures/jobs-feed.json",
  pageSize: 3,
  maxPages: 20,
  fieldMap: {
    externalId: "id",
    title: "role",
    company: "company.name",
    location: "city",
    workMode: "arrangement",
    employmentType: "contract",
    description: "summary",
    requiredSkills: "skills_required",
    preferredSkills: "skills_nice",
    applicationUrl: "apply",
    postedAt: "posted",
    expiresAt: "expires",
    salaryMin: "pay.min",
    salaryMax: "pay.max",
    salaryCurrency: "pay.currency",
    salaryPeriod: "pay.period",
  },
};

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  if (process.argv.includes("--remove")) {
    const removed = await sql`delete from arena.job_sources where slug = ${SLUG} returning id`;
    console.log(removed.length ? `Removed the ${SLUG} source and its openings.` : `No ${SLUG} source to remove.`);
  } else {
    const [row] = await sql`
      insert into arena.job_sources (slug, name, adapter, config, is_active, sync_interval_minutes, staleness_days)
      values (${SLUG}, ${"Fixture lokal (bukan lowongan nyata)"}, ${"fixture-file"}, ${sql.json(config)}, true, 60, 3)
      on conflict (slug) do update set
        name = excluded.name, adapter = excluded.adapter, config = excluded.config,
        is_active = true, updated_at = now()
      returning id, slug`;
    console.log(`Registered fixture jobs source ${row.slug} (${row.id}).`);
    console.log("Run `npm run jobs:sync:fixture` or press “Tarik sekarang” in /app/admin/careers to ingest it.");
  }
} finally {
  await sql.end({ timeout: 5 });
}
