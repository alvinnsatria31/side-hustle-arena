// The suite CI can actually run: every test that needs neither a live database
// nor a paid provider.
//
// Discovery, not a hand-kept list. A suite that reads DATABASE_URL needs a real
// Postgres and is excluded automatically, so adding an offline test file is
// enough to get it covered — nobody has to remember to register it here.
//
// Anything skipped is printed with its reason. A CI job that silently narrows
// what it runs is worse than no CI job: it reports green for a shrinking share
// of the codebase and nobody notices.
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

/**
 * Suites excluded for a reason other than "needs a database".
 *
 * Every entry must say what is wrong and what would let it come back. This list
 * is meant to shrink; treat a growing one as a problem, not as housekeeping.
 */
const KNOWN_EXCLUSIONS = {
  "cv-scan-live.test.mjs":
    "calls the real CV provider — needs AI_CV_API_KEY and spends money per run.",
  "project-scheduler.test.mjs":
    "'cron dates fit the preview window' expects sub-daily vercel.json crons; the deployed values are daily because Vercel Hobby cannot do sub-daily, and n8n is the real scheduler. Pre-existing and deliberate — see docs/backend/IMPLEMENTATION_AUDIT_2026-09-07.md.",
};

const files = readdirSync(join(root, "scripts"))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort();

const run = [];
const skipped = [];

for (const name of files) {
  if (KNOWN_EXCLUSIONS[name]) {
    skipped.push([name, KNOWN_EXCLUSIONS[name]]);
    continue;
  }
  // The suites that stand up their own fixtures read DATABASE_URL directly.
  if (readFileSync(join(root, "scripts", name), "utf8").includes("DATABASE_URL")) {
    skipped.push([name, "needs a live PostgreSQL database."]);
    continue;
  }
  run.push(join("scripts", name));
}

console.log(`Running ${run.length} offline suites; skipping ${skipped.length}.\n`);
for (const [name, reason] of skipped) console.log(`  skip  ${name}\n        ${reason}`);
console.log("");

const result = spawnSync(
  process.execPath,
  ["--import", "./scripts/node-test-hooks.mjs", "--test", "--test-force-exit", ...run],
  { cwd: root, stdio: "inherit" },
);

process.exit(result.status ?? 1);
