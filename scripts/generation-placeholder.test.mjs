// A06 regression: unwritten content must never be publishable.
//
// The bootstrap script fills fields a legacy project never had with an obvious
// [PLACEHOLDER] marker rather than inventing curriculum prose — which is the
// right call. What was wrong was registering the result as HIGH_QUALITY: that
// is the tag the generator draws fallback candidates from, so on a week with
// no AI provider a participant could have opened a brief whose mission read
// "[PLACEHOLDER] Misi belum ditulis". Structural validity and editorial
// readiness are different questions, and only the first was being asked.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chooseCandidate, placeholderFields, validatePackage } from "../src/server/generation/core.ts";

const DIVISION = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const SKILL_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3302";
const SKILL_B = "3f2504e0-4f89-41d3-9a0c-0305e82c3303";

const rubric = [
  { name: "Execution", description: "Menilai kualitas eksekusi deliverable.", weight: 3, maxScore: 100, reviewInstruction: "Periksa kelengkapan dan ketepatan hasil kerja." },
  { name: "Communication", description: "Menilai kejelasan penjelasan peserta.", weight: 1, maxScore: 100, reviewInstruction: "Periksa struktur dan kejelasan argumen." },
];

function complete(overrides = {}) {
  return {
    divisionId: DIVISION,
    title: "Analisis Penjualan Ritel",
    shortDescription: "Menggabungkan data penjualan tiga kanal menjadi satu laporan margin.",
    caseBackground: "Sebuah jaringan ritel kehilangan visibilitas margin sejak menambah kanal daring.",
    roleDescription: "Kamu berperan sebagai analis data junior di tim komersial.",
    objective: "Menyusun laporan margin per kanal yang bisa dipakai rapat mingguan.",
    mission: "Bersihkan data penjualan lalu hitung margin per kanal dan jelaskan temuannya.",
    difficulty: "STANDARD",
    estimatedMinutes: 240,
    skills: [{ skillId: SKILL_A, weight: 2 }, { skillId: SKILL_B, weight: 1 }],
    rubric,
    requirements: [{
      label: "Laporan analisis", type: "FILE", required: true, minItems: 1, maxItems: 1,
      allowedMimeTypes: ["application/pdf"], allowedLinkTypes: [],
      instructions: "Unggah satu berkas PDF berisi tabel margin dan ringkasan temuan.",
    }],
    resources: [],
    fingerprint: {
      industry: "Ritel", role: "Analis data", coreSkill: "Analisis data", secondarySkill: "Komunikasi",
      scenarioType: "Diagnosis", decisionType: "Prioritisasi", primaryDeliverable: "Laporan",
      inputDataType: "Tabel penjualan", targetStakeholder: "Manajer komersial", toolCategory: "Spreadsheet",
    },
    ...overrides,
  };
}

const context = () => ({ divisionId: DIVISION, skillIds: [SKILL_A, SKILL_B], baseRubric: rubric });

test("a fully written package validates and reports no placeholder fields", () => {
  const p = validatePackage(complete(), context());
  assert.deepEqual(placeholderFields(p), []);
});

test("every unwritten marker in a reader-visible field is caught", () => {
  const cases = {
    mission: "[PLACEHOLDER] Misi belum ditulis. Ganti teks ini lewat konsol admin.",
    caseBackground: "TBD — latar kasus menyusul setelah rapat kurikulum minggu depan.",
    roleDescription: "TODO: tulis deskripsi peran peserta di proyek ini nanti.",
    shortDescription: "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do.",
  };
  for (const [field, value] of Object.entries(cases)) {
    assert.throws(
      () => validatePackage(complete({ [field]: value }), context()),
      (error) => {
        assert.equal(error.code, "VALIDATION_ERROR");
        assert.match(error.message, /placeholder/i);
        return true;
      },
      `${field} carrying "${value.slice(0, 20)}" should have been rejected`,
    );
  }
});

test("placeholders hidden in the rubric, requirements or fingerprint are caught too", () => {
  const markedRubric = [{ ...rubric[0], reviewInstruction: "[PLACEHOLDER] Instruksi penilaian belum ditulis." }, rubric[1]];
  assert.throws(() => validatePackage(complete({ rubric: markedRubric }), context()), /placeholder/i);

  const markedRequirement = [{ ...complete().requirements[0], instructions: "[PLACEHOLDER] Instruksi unggahan belum ditulis." }];
  assert.throws(() => validatePackage(complete({ requirements: markedRequirement }), context()), /placeholder/i);

  // The fingerprint is not shown to a participant, but a marked one makes every
  // bootstrapped division look like a near-duplicate of every other, which
  // silently blocks future generation. It counts.
  const markedFingerprint = { ...complete().fingerprint, industry: "[PLACEHOLDER] industri" };
  assert.throws(() => validatePackage(complete({ fingerprint: markedFingerprint }), context()), /placeholder/i);
});

test("the escape hatch is explicit, narrow, and still validates everything else", () => {
  const marked = complete({ mission: "[PLACEHOLDER] Misi belum ditulis. Ganti lewat konsol admin." });
  const p = validatePackage(marked, context(), { allowPlaceholders: true });
  assert.equal(placeholderFields(p).length, 1);
  // Structure is still enforced under the escape hatch: this is not a bypass.
  assert.throws(() => validatePackage({ ...marked, skills: [] }, context(), { allowPlaceholders: true }), /validation/i);
  assert.throws(
    () => validatePackage({ ...marked, rubric: [{ ...rubric[0], weight: 9 }, rubric[1]] }, context(), { allowPlaceholders: true }),
    /frozen/i,
  );
});

test("a placeholder library entry can never be chosen as a generation candidate", async () => {
  const marked = complete({ mission: "[PLACEHOLDER] Misi belum ditulis. Ganti lewat konsol admin." });
  const chosen = await chooseCandidate({
    context: context(),
    history: [],
    library: [{ projectId: "bootstrapped", tag: "HIGH_QUALITY", package: marked }],
  });
  // Even if a mis-tagged entry reached the pool, the strict validator refuses
  // it — belt and braces, because the tag is metadata and the text is truth.
  assert.equal(chosen.package, undefined);
  assert.equal(chosen.rejectedLibrary.length, 1);
  assert.match(chosen.rejectedLibrary[0].reason, /placeholder/i);
});

test("the bootstrap script registers needs-curation, not high-quality", () => {
  const source = readFileSync(new URL("./bootstrap-generation-library.mjs", import.meta.url), "utf8");
  assert.match(source, /tag:\s*"NEEDS_CURATION"/);
  assert.doesNotMatch(source, /tag:\s*"HIGH_QUALITY"/);
});

test("the generator only draws candidates from curated tags", () => {
  const source = readFileSync(new URL("../src/server/generation/service.ts", import.meta.url), "utf8");
  // A tag list that opts in beats one that opts out: adding a future tag then
  // defaults to "not publishable" rather than silently joining the pool.
  assert.match(source, /record\.tag === "HIGH_QUALITY" \|\| record\.tag === "EVERGREEN"/);
});
