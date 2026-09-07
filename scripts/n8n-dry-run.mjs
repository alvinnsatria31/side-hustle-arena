// Replay the n8n scheduler workflow against a running Arena, without n8n.
//
//   node scripts/n8n-dry-run.mjs                      -> every trigger, against ARENA_ORIGIN
//   node scripts/n8n-dry-run.mjs reviews-run          -> one job
//   ARENA_BASE_URL=https://arena.sekolahkarir.id node scripts/n8n-dry-run.mjs
//
// Why this exists: "is the workflow correct?" and "is n8n configured?" are two
// different questions, and mixing them is what makes this hard to debug. The
// workflow's whole logic is one code node plus one HTTP request, so it can be
// executed here — reading the SAME JSON n8n imports, running its ACTUAL router
// source, and issuing the same authenticated GET. If this passes, anything that
// still fails afterwards is n8n's configuration, not the contract.
//
// Read-only in spirit but NOT in effect: these are the real scheduled jobs and
// they do real work. Point it at a local Arena unless you mean it.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import nextEnv from "@next/env";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root);

const base = (process.env.ARENA_BASE_URL ?? process.env.ARENA_ORIGIN ?? "http://localhost:3001").replace(/\/$/, "");
const token = process.env.ARENA_CRON_TOKEN ?? process.env.CRON_SECRET ?? process.env.INTERNAL_AUTOMATION_TOKEN;
const only = process.argv[2];

if (!token) {
  console.error("No credential. Set CRON_SECRET (or INTERNAL_AUTOMATION_TOKEN) in .env — the cron routes fail closed without one.");
  process.exit(1);
}

const workflow = JSON.parse(readFileSync(resolve(root, "n8n/arena-trigger-workflow.json"), "utf8"));
const router = workflow.nodes.find((node) => node.id === "route");
const triggers = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.scheduleTrigger");

console.log(`Arena    : ${base}`);
console.log(`Workflow : ${workflow.name} (${workflow.meta?.arenaContractVersion ?? "no contract version"})`);
console.log(`Timezone : ${workflow.settings?.timezone ?? "unset"}\n`);

let failures = 0;
let gatedCount = 0;

for (const trigger of triggers) {
  // The router is n8n's own code node, executed verbatim. A trigger renamed
  // without updating the map throws here exactly as it would in production.
  let jobs;
  try {
    jobs = runInNewContext(`(function () { ${router.parameters.jsCode} })()`, { $prevNode: { name: trigger.name } });
  } catch (error) {
    console.log(`✖ ${trigger.name}\n    router: ${error.message}`);
    failures += 1;
    continue;
  }

  for (const { json } of jobs) {
    if (only && json.job !== only) continue;
    const url = `${base}/api/cron/${json.job}`;
    const started = Date.now();
    try {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(120_000),
      });
      const body = await response.json().catch(() => null);
      const data = body?.data ?? {};
      const detail = data.detail ?? body?.error ?? {};
      // Three states, not two. A job that reports `skipped` looked for work and
      // found none, or is switched off by a flag — neither is a fault, and
      // calling them failures trains an operator to ignore this output.
      //
      // Worth knowing: n8n's own "Summarise the run" node has only two states
      // and treats any `done: false` as failed, so a config-gated job WILL show
      // red there until its flag is turned on. That is n8n's summary being
      // blunter than reality, not a different result.
      const reachable = response.status === 200;
      const gated = reachable && data.done === false && typeof detail.skipped === "string";
      const ok = reachable && data.done !== false;
      const mark = ok ? "✔" : gated ? "○" : "✖";
      // Only the STRING form of `skipped` is a reason. email-flush reports a
      // numeric `skipped` count inside its totals, and printing that as a reason
      // reads as "skipped — 1", which says nothing.
      const summary = typeof detail.skipped === "string"
        ? `skipped — ${detail.skipped}`
        : JSON.stringify(detail).slice(0, 160);
      console.log(`${mark} ${json.job.padEnd(19)} ${String(response.status).padEnd(4)} ${Date.now() - started}ms  ${summary}`);
      if (gated) gatedCount += 1;
      else if (!ok) failures += 1;
    } catch (error) {
      console.log(`✖ ${json.job.padEnd(19)} ${error.name}: ${error.message}`);
      failures += 1;
    }
  }
}

console.log(`\n${failures === 0 ? "All jobs answered." : `${failures} job(s) FAILED.`}`);
if (gatedCount) {
  console.log(`${gatedCount} job(s) switched off by a flag (○). Not a fault — but n8n's own summary`);
  console.log(`will still show these as failures, because it treats any done:false as one.`);
  console.log(`Turn them on with ARENA_GENERATION_ENABLED=true / ARENA_AUTO_PUBLISH_ENABLED=true.`);
}
process.exit(failures === 0 ? 0 : 1);
