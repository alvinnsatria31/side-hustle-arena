import assert from "node:assert/strict";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const SEED_WEEK_CODE = "DEV-ARENA-CORE-CURRENT";
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1_000;

function requireDevelopmentDatabase() {
  assert.equal(process.env.APP_ENV, "development", "Arena core seed requires APP_ENV=development");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured for the Arena core seed");
}

function currentJakartaWeek(now) {
  const local = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const mondayOffset = (local.getUTCDay() + 6) % 7;
  const mondayUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - mondayOffset, 0, 0, 0, 0);
  const opensAt = new Date(mondayUtc - JAKARTA_OFFSET_MS);
  const deadlineAt = new Date(mondayUtc + 4 * 24 * 60 * 60 * 1_000 + 23 * 60 * 60 * 1_000 + 59 * 60 * 1_000 + 59_999 - JAKARTA_OFFSET_MS);
  return {
    opensAt,
    deadlineAt,
    status: now < opensAt ? "SCHEDULED" : now >= deadlineAt ? "CLOSED" : "OPEN",
  };
}

const divisions = [
  { slug: "dev-arena-core-data", name: "Data", description: "Development data-analysis projects", sortOrder: 1 },
  { slug: "dev-arena-core-product", name: "Product", description: "Development product projects", sortOrder: 2 },
  { slug: "dev-arena-core-design", name: "Design", description: "Development design projects", sortOrder: 3 },
];

const projects = [
  {
    divisionSlug: "dev-arena-core-data",
    slug: "dev-arena-core-sales-insights",
    title: "Sales Insight Brief",
    shortDescription: "Turn a small sales dataset into three decisions for a local business.",
    mission: "Find useful patterns and communicate the decision they support.",
    objective: "Create a concise analysis that a business owner can act on.",
    skill: { slug: "dev-arena-core-analysis", name: "Analysis", category: "Data" },
    rubric: ["Problem framing", "Evidence", "Recommendation"],
    requirement: { label: "Public analysis link", type: "LINK", instructions: "Share a reviewer-accessible analysis link." },
  },
  {
    divisionSlug: "dev-arena-core-product",
    slug: "dev-arena-core-onboarding-plan",
    title: "Onboarding Improvement Plan",
    shortDescription: "Identify one activation friction and propose a measurable product change.",
    mission: "Turn an onboarding observation into a scoped experiment.",
    objective: "Write a clear product rationale and success measure.",
    skill: { slug: "dev-arena-core-product-thinking", name: "Product Thinking", category: "Product" },
    rubric: ["User understanding", "Prioritization", "Measurement"],
    requirement: { label: "Public product brief", type: "LINK", instructions: "Share a reviewer-accessible brief link." },
  },
  {
    divisionSlug: "dev-arena-core-design",
    slug: "dev-arena-core-checkout-flow",
    title: "Checkout Flow Improvement",
    shortDescription: "Improve a single checkout decision point with a focused user-flow proposal.",
    mission: "Make a high-friction journey step easier to complete.",
    objective: "Present a clear before-and-after flow with rationale.",
    skill: { slug: "dev-arena-core-ux-design", name: "UX Design", category: "Design" },
    rubric: ["Flow clarity", "Interaction rationale", "Presentation"],
    requirement: { label: "Public design link", type: "LINK", instructions: "Share a reviewer-accessible design link." },
  },
];

async function seed() {
  requireDevelopmentDatabase();
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const now = new Date();
  const weekWindow = currentJakartaWeek(now);

  try {
    const [week] = await sql`
      insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
      values (${SEED_WEEK_CODE}, 'Development Arena Core Week', ${weekWindow.status}, ${weekWindow.opensAt}, ${weekWindow.deadlineAt}, 'Asia/Jakarta')
      on conflict (week_code) do update set
        title = excluded.title,
        status = excluded.status,
        opens_at = excluded.opens_at,
        submission_deadline_at = excluded.submission_deadline_at,
        timezone = excluded.timezone,
        updated_at = now()
      returning id
    `;
    await sql`
      insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission)
      values (${week.id}, 1, 3, false)
      on conflict (week_id) do update set
        max_projects_per_user = excluded.max_projects_per_user,
        max_review_attempts = excluded.max_review_attempts,
        allow_late_submission = excluded.allow_late_submission,
        updated_at = now()
    `;

    const divisionIds = new Map();
    for (const division of divisions) {
      const [row] = await sql`
        insert into arena.divisions (slug, name, description, is_active, sort_order)
        values (${division.slug}, ${division.name}, ${division.description}, true, ${division.sortOrder})
        on conflict (slug) do update set
          name = excluded.name,
          description = excluded.description,
          is_active = true,
          sort_order = excluded.sort_order,
          updated_at = now()
        returning id
      `;
      divisionIds.set(division.slug, row.id);
    }

    await sql`delete from arena.project_skills where project_id in (select id from arena.projects where week_id = ${week.id} and slug like 'dev-arena-core-%')`;
    await sql`delete from arena.project_rubric_criteria where project_id in (select id from arena.projects where week_id = ${week.id} and slug like 'dev-arena-core-%')`;
    await sql`delete from arena.project_submission_requirements where project_id in (select id from arena.projects where week_id = ${week.id} and slug like 'dev-arena-core-%')`;

    for (const project of projects) {
      const [skill] = await sql`
        insert into arena.skills (slug, name, category)
        values (${project.skill.slug}, ${project.skill.name}, ${project.skill.category})
        on conflict (slug) do update set name = excluded.name, category = excluded.category, updated_at = now()
        returning id
      `;
      const [seededProject] = await sql`
        insert into arena.projects (week_id, division_id, slug, title, short_description, mission, objective, estimated_minutes, status, published_at)
        values (${week.id}, ${divisionIds.get(project.divisionSlug)}, ${project.slug}, ${project.title}, ${project.shortDescription}, ${project.mission}, ${project.objective}, 180, 'PUBLISHED', ${weekWindow.opensAt})
        on conflict (week_id, slug) do update set
          division_id = excluded.division_id,
          title = excluded.title,
          short_description = excluded.short_description,
          mission = excluded.mission,
          objective = excluded.objective,
          estimated_minutes = excluded.estimated_minutes,
          status = excluded.status,
          published_at = excluded.published_at,
          updated_at = now()
        returning id
      `;
      await sql`insert into arena.project_skills (project_id, skill_id, weight) values (${seededProject.id}, ${skill.id}, 1) on conflict (project_id, skill_id) do nothing`;
      for (let index = 0; index < project.rubric.length; index += 1) {
        await sql`insert into arena.project_rubric_criteria (project_id, name, weight, max_score, sort_order) values (${seededProject.id}, ${project.rubric[index]}, 1, 100, ${index})`;
      }
      await sql`insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order) values (${seededProject.id}, ${project.requirement.label}, ${project.requirement.type}, true, 1, 1, ${project.requirement.instructions}, 0)`;
    }

    const dataDivisionId = divisionIds.get("dev-arena-core-data");
    await sql`
      insert into arena.projects (week_id, division_id, slug, title, short_description, status)
      values (${week.id}, ${dataDivisionId}, 'dev-arena-core-draft', 'Development Draft Project', 'This draft verifies user-facing visibility filtering.', 'DRAFT')
      on conflict (week_id, slug) do update set
        division_id = excluded.division_id,
        title = excluded.title,
        short_description = excluded.short_description,
        status = excluded.status,
        published_at = null,
        updated_at = now()
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await seed();
