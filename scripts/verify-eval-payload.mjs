/**
 * Check a candidate grading payload before it ever reaches production.
 *
 *   node scripts/verify-eval-payload.mjs contoh.json
 *   node scripts/verify-eval-payload.mjs contoh.json --version <uuid>
 *
 * Validates against the very schema `/api/webhooks/arena-eval` uses, so a file
 * that passes here is a file the endpoint accepts. With `--version` it also
 * checks the payload against that submission version's real rubric — every
 * criterion covered exactly once, ids that actually exist, scores inside their
 * per-criterion maximum — which is where a hand-built n8n payload usually fails.
 *
 * Exists because the alternative is iterating on a workflow by POSTing at a
 * live endpoint and reading 400s.
 */
import { readFileSync } from "node:fs";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const [, , file, ...rest] = process.argv;
if (!file) {
  console.error("usage: node scripts/verify-eval-payload.mjs <payload.json> [--version <uuid>]");
  process.exit(1);
}
const versionFlag = rest.indexOf("--version");
const versionId = versionFlag >= 0 ? rest[versionFlag + 1] : undefined;

const { reviewerOutputSchema } = await import("../src/server/reviews/review-schema.ts");
const { validateReviewerOutput } = await import("../src/server/reviews/validator.ts");

let raw;
try {
  raw = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  console.error(`GAGAL — berkas bukan JSON yang sah: ${error.message}`);
  process.exit(1);
}

// Accept either the whole webhook body or just the `output` object, since a
// workflow author is usually holding one or the other.
const body = raw.output ? raw : { output: raw };
const problems = [];

// Checked whether or not the file is wrapped, because the payload someone
// pastes first is usually the one the workflow sends today.
if (raw.submission_id) problems.push("submission_id tidak dipakai lagi — Arena menilai per VERSI, kirim version_id");
if (raw.score !== undefined) problems.push("score tidak diterima — backend yang menghitung skor tertimbang dari bukti per kriteria");
if (raw.ai_feedback !== undefined) problems.push("ai_feedback tidak dipakai — pindahkan ke output.strengths dan output.priorityImprovements");
if (raw.rubric_breakdown !== undefined) problems.push("rubric_breakdown diganti output.criteria[]: tiap kriteria butuh score, evidence[], dan confidence");
if (raw.xp_award !== undefined) problems.push("xp_award tidak diterima — poin diberikan saat finalisasi minggu, bukan oleh grader");
if (raw.output && typeof raw.version_id !== "string") {
  problems.push("version_id wajib ada dan berupa UUID versi submission (bukan submission_id)");
}

const parsed = reviewerOutputSchema.safeParse(body.output);
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    problems.push(`output.${issue.path.join(".")}: ${issue.message}`);
  }
}

if (problems.length > 0) {
  console.error("GAGAL\n");
  for (const p of problems) console.error(`  · ${p}`);
  console.error("\nBentuk yang benar ada di docs/backend/HERMES_EVAL_CONTRACT.md");
  process.exit(1);
}

console.log("Skema: LOLOS");

const target = versionId ?? (raw.output ? raw.version_id : undefined);
if (!target) {
  console.log("\nRubrik belum diperiksa. Tambahkan --version <uuid> untuk mengecek");
  console.log("id kriteria, cakupan, dan batas skor terhadap rubrik yang sebenarnya.");
  process.exit(0);
}

const postgres = (await import("postgres")).default;
if (!process.env.DATABASE_URL) {
  console.error("\nDATABASE_URL belum diisi — pemeriksaan rubrik dilewati.");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const rows = await sql`
    select c.id, c.name, c.max_score, c.weight
    from arena.project_rubric_criteria c
    join arena.projects p on p.id = c.project_id
    join arena.submissions s on s.project_id = p.id
    join arena.submission_versions v on v.submission_id = s.id
    where v.id = ${target}
    order by c.sort_order`;

  if (rows.length === 0) {
    console.error(`\nGAGAL — tidak ada rubrik untuk versi ${target}.`);
    console.error("Pastikan UUID-nya benar dan project itu punya rubrik.");
    process.exit(1);
  }

  // weight and max_score are numeric columns, so postgres hands them back as
  // strings; the validator compares them as numbers.
  const rubric = rows.map((r) => ({
    id: r.id,
    name: r.name,
    maxScore: Number(r.max_score),
    weight: Number(r.weight),
  }));
  const result = validateReviewerOutput(parsed.data, rubric);
  if (!result.ok) {
    console.error("\nRubrik: GAGAL\n");
    for (const e of result.errors) console.error(`  · ${e}`);
    console.error("\nId kriteria yang benar untuk versi ini:");
    for (const c of rubric) console.error(`  · ${c.id}  ${c.name} (maks ${c.maxScore})`);
    process.exit(1);
  }
  console.log(`Rubrik: LOLOS (${rubric.length} kriteria terpenuhi)`);
  if (result.warnings?.length) {
    console.log("\nPeringatan (diterima, tapi perhatikan):");
    for (const w of result.warnings) console.log(`  · ${w}`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
