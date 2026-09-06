/**
 * Give each active division the base rubric its generator requires.
 *
 * `contextFor` refuses to generate for a division with no frozen base rubric,
 * and nothing creates one: the core seed writes divisions and projects but
 * never registers a library template, so on any fresh database the first
 * off-schedule release fails at the generate step with a message about library
 * templates — which reads like a bug rather than a missing setup step.
 *
 * `registerLibraryTemplate` freezes the rubric the first time a division gets
 * a template, so this script builds one complete, valid package per division
 * from a project that division has already published, and registers it.
 *
 * PLACEHOLDER TEXT IS DELIBERATE. A published project rarely carries every
 * field the package schema requires — case background, role description and
 * the ten fingerprint facets are usually absent — and inventing plausible
 * prose for them would put words in the curriculum's mouth. Every gap is
 * filled with an obvious `[PLACEHOLDER]` marker instead, so the base rubric
 * (which is what generation actually needs) is established immediately and the
 * wording can be corrected afterwards in the console's project editor.
 *
 * Run once per database:
 *   npm run db:bootstrap:library
 *
 * Idempotent: a division that already has a frozen base rubric is skipped.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { registerLibraryTemplate } from "@/server/generation/service";

if (!process.env.DATABASE_URL) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const MARK = "[PLACEHOLDER]";
const filler = (what) => `${MARK} ${what} belum ditulis. Ganti teks ini lewat konsol admin di halaman Project sebelum dipakai sebagai contoh generasi.`;
const facet = (name) => `${MARK} ${name}`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const actorSubject = process.argv.includes("--actor")
  ? process.argv[process.argv.indexOf("--actor") + 1]
  : "service:bootstrap";

function packageFor(project, skills, rubric, requirements) {
  return {
    divisionId: project.division_id,
    title: project.title,
    shortDescription: project.short_description?.trim() || filler("Deskripsi singkat"),
    caseBackground: project.case_background?.trim() || filler("Latar kasus"),
    roleDescription: project.role_description?.trim() || filler("Deskripsi peran"),
    objective: project.objective?.trim() || filler("Tujuan"),
    mission: project.mission?.trim() || filler("Misi"),
    difficulty: "STANDARD",
    // The schema floor is 120 minutes; a legacy row may hold less or nothing.
    estimatedMinutes: Math.min(960, Math.max(120, project.estimated_minutes ?? 180)),
    skills: skills.map((row) => ({ skillId: row.skill_id, weight: Math.max(0.01, Number(row.weight ?? 1)) })),
    rubric: rubric.map((row) => ({
      name: row.name,
      description: row.description?.trim() || filler(`Deskripsi kriteria "${row.name}"`),
      weight: Number(row.weight),
      maxScore: Number(row.max_score),
      reviewInstruction: row.review_instruction?.trim() || filler(`Instruksi penilaian "${row.name}"`),
    })),
    requirements: requirements.map((row) => ({
      label: row.label,
      type: row.type,
      required: row.required,
      minItems: row.min_items,
      maxItems: row.max_items,
      allowedMimeTypes: row.allowed_mime_types ?? [],
      allowedLinkTypes: row.allowed_link_types ?? [],
      instructions: row.instructions?.trim() || filler(`Instruksi "${row.label}"`),
    })),
    resources: [],
    // Ten facets the duplicate detector compares releases on. Marked rather
    // than guessed: a wrong fingerprint would make unrelated projects look
    // like near-duplicates and silently block future generation.
    fingerprint: {
      industry: facet("industri"), role: facet("peran"), coreSkill: facet("skill utama"),
      secondarySkill: facet("skill pendukung"), scenarioType: facet("tipe skenario"),
      decisionType: facet("tipe keputusan"), primaryDeliverable: facet("deliverable utama"),
      inputDataType: facet("tipe data masukan"), targetStakeholder: facet("stakeholder"),
      toolCategory: facet("kategori tool"),
    },
  };
}

async function main() {
  const divisions = await sql`select id, slug, name from arena.divisions where is_active = true order by sort_order, name`;
  const frozen = await sql`select distinct entity_id from audit.logs where action = 'generation.rubric-frozen'`;
  const ready = new Set(frozen.map((row) => row.entity_id));

  let registered = 0;
  const blocked = [];

  for (const division of divisions) {
    if (ready.has(division.id)) {
      console.log(`skip  ${division.slug} — base rubric already frozen`);
      continue;
    }
    const [project] = await sql`
      select * from arena.projects
      where division_id = ${division.id} and status in ('PUBLISHED', 'ARCHIVED')
      order by published_at desc nulls last, created_at desc limit 1`;
    if (!project) {
      blocked.push(division.slug);
      console.log(`BLOCK ${division.slug} — no published or archived project to build a template from`);
      continue;
    }
    const skills = await sql`select skill_id, weight from arena.project_skills where project_id = ${project.id} order by skill_id`;
    const rubric = await sql`select name, description, weight, max_score, review_instruction from arena.project_rubric_criteria where project_id = ${project.id} order by sort_order`;
    const requirements = await sql`select label, type, required, min_items, max_items, allowed_mime_types, allowed_link_types, instructions from arena.project_submission_requirements where project_id = ${project.id} order by sort_order`;

    if (!skills.length || !rubric.length || !requirements.length) {
      blocked.push(division.slug);
      console.log(`BLOCK ${division.slug} — "${project.title}" has no ${!skills.length ? "skills" : !rubric.length ? "rubric" : "requirements"}; the package schema needs at least one`);
      continue;
    }

    try {
      await registerLibraryTemplate({
        projectId: project.id,
        tag: "HIGH_QUALITY",
        package: packageFor(project, skills, rubric, requirements),
        reason: "Bootstrap base rubric for project generation",
        actorSubject,
        actorType: "ADMIN",
      });
      registered += 1;
      console.log(`OK    ${division.slug} — frozen from "${project.title}"`);
    } catch (error) {
      blocked.push(division.slug);
      console.log(`BLOCK ${division.slug} — ${error?.message ?? error}`);
    }
  }

  console.log(`\n${registered} division(s) registered, ${blocked.length} blocked.`);
  if (registered > 0) {
    console.log(`Placeholder wording was inserted where the source project had none. Search the console's\nProject pages for "${MARK}" and replace it before treating these as real examples.`);
  }
  if (blocked.length) {
    console.log(`Blocked: ${blocked.join(", ")}. Publish one complete project in each (title, at least one\nskill, one rubric criterion and one submission requirement), then run this again.`);
  }
  await sql.end({ timeout: 5 });
  process.exitCode = blocked.length ? 1 : 0;
}

await main();
