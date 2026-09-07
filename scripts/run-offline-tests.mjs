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
  // The suites that stand up their own fixtures READ the variable; matching the
  // bare word instead caught any file that merely mentioned it — a fixture
  // connection string handed to a pure validator, or a comment explaining the
  // rule — and skipped suites that were perfectly offline.
  if (/process\.env\.DATABASE_URL/.test(readFileSync(join(root, "scripts", name), "utf8"))) {
    skipped.push([name, "needs a live PostgreSQL database."]);
    continue;
  }
  run.push(join("scripts", name));
}

console.log(`Running ${run.length} offline suites; skipping ${skipped.length}.\n`);
for (const [name, reason] of skipped) console.log(`  skip  ${name}\n        ${reason}`);
console.log("");

/**
 * Point the database at nothing on purpose.
 *
 * "Offline" is decided by reading the test file for DATABASE_URL, and that
 * heuristic cannot see a suite that reaches Postgres through a service's
 * default `db = getDb()` argument. One did: the voucher-push test queried a
 * real database for a UUID that happens not to exist, so it passed on any
 * machine whose .env pointed somewhere live and only failed once CI ran it
 * against nothing. Green for the wrong reason is the worst outcome a test
 * runner can produce.
 *
 * A loopback address on a closed port still parses as a valid URL — so config
 * validation at import time is satisfied — and refuses to connect. Any suite
 * that quietly needs the database now fails here, on the developer's machine,
 * instead of surviving until CI.
 */
const result = spawnSync(
  process.execPath,
  ["--import", "./scripts/node-test-hooks.mjs", "--test", "--test-force-exit", ...run],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "postgresql://offline:offline@127.0.0.1:1/offline" },
  },
);

process.exit(result.status ?? 1);
