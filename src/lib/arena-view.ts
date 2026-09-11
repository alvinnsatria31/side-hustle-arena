import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { projectSkills, skills } from "@/server/db/schema";
import { getCurrentArenaWeek, getVisibleArenaProject, listActiveArenaDivisions, listVisibleArenaProjects } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";
import { deadlineLabel } from "@/lib/deadline";
import type { ArenaProject, ProjectDifficulty, ProjectResource } from "@/types/project";

// Kept exported here: existing pages import it from this module, and the
// formatter itself now lives in @/lib/deadline so client components share it.
export { deadlineLabel };

/**
 * Public read seam (Phase 9a): backend rows → the view models the approved
 * components already render. Visuals stay frozen; only data sources move.
 *
 * Honest mappings (no invented numbers):
 * - points/participants stay ABSENT (per-project points and live counters
 *   were mock-only; PRD pays points by rank, not by project).
 * - difficulty "STANDARD" is the only band the schema knows today → shown as
 *   Intermediate until the generator phase ships real bands.
 * - week number is the ISO week of the project's own week, and the deadline
 *   label renders that week's real timestamp — never the currently open week's,
 *   which is what made archived and ad-hoc briefs advertise the wrong day.
 */

export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export function monthDayLabel(date: Date): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "Asia/Jakarta" }).format(date).toUpperCase();
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "Asia/Jakarta" }).format(date);
  return `${month} ${day}`;
}

function difficultyLabel(band: string): ProjectDifficulty {
  // Single-band schema phase: STANDARD is the entry/junior band.
  if (band === "STANDARD") return "Intermediate";
  if (band === "BEGINNER") return "Beginner";
  if (band === "ADVANCED") return "Advanced";
  return "Intermediate";
}

/**
 * Resource rows → the view model the resource list renders.
 *
 * The URL is the point. This mapper used to return `[]` and the component below
 * it rendered titles with nothing behind them, so a brief could name a dataset
 * the participant had no way to open. Kind is lowercased for the icon map and
 * is presentation only.
 */
function toProjectResources(rows: Array<{ id: string; label: string; url: string; kind: string }>): ProjectResource[] {
  return rows.map((row) => ({ id: row.id, title: row.label, kind: row.kind.toLowerCase() as ProjectResource["kind"], url: row.url }));
}

function estimatedLabel(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "Fleksibel";
  const hours = minutes / 60;
  const formatted = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Math.round(hours * 2) / 2);
  return `${formatted} jam`;
}

type Summary = Awaited<ReturnType<typeof listVisibleArenaProjects>>[number];
type Detail = Awaited<ReturnType<typeof getVisibleArenaProject>>;

function toBaseProject(project: Summary, weekNo: number, deadline: string): ArenaProject {
  return {
    slug: project.slug,
    category: project.division.name,
    group: project.division.name,
    week: weekNo,
    title: project.title,
    shortDescription: project.shortDescription ?? "",
    caseBackground: "",
    role: "",
    mission: "",
    objective: [],
    deliverables: [],
    skills: [],
    resources: [],
    difficulty: difficultyLabel(project.difficulty),
    estimatedTime: estimatedLabel(project.estimatedMinutes),
    deadlineLabel: deadline,
    rubric: [],
    isThisWeek: true,
  };
}

export interface PublicArenaHome {
  weekNo: number;
  weekLabel: string;
  deadline: string;
  canSelect: boolean;
  status: string;
  projectCount: number;
  divisionCount: number;
  projects: Array<{ slug: string; title: string; category: string }>;
}

/**
 * Having no current week is an empty state, not a failure: it is what a fresh
 * deployment looks like before the first week is created, and what a gap
 * between an archived week and the next one would look like. A public page
 * must render that, not throw.
 *
 * Only WEEK_NOT_FOUND is swallowed — a database outage still has to surface as
 * an error rather than masquerading as "no projects this week".
 */
async function currentWeekOrNull() {
  try {
    return await getCurrentArenaWeek();
  } catch (error) {
    if (error instanceof ArenaDomainError && error.code === "WEEK_NOT_FOUND") return null;
    throw error;
  }
}

export async function getPublicArenaHome(): Promise<PublicArenaHome | null> {
  const week = await currentWeekOrNull();
  if (!week) return null;
  const [projects, divisions] = await Promise.all([
    listVisibleArenaProjects(),
    listActiveArenaDivisions(),
  ]);
  const opensAt = new Date(week.opensAt);
  const weekNo = isoWeekNumber(opensAt);
  return {
    weekNo,
    weekLabel: `WEEK ${weekNo} · ${monthDayLabel(opensAt)}`,
    deadline: deadlineLabel(new Date(week.submissionDeadlineAt)),
    canSelect: week.selection.canSelect,
    status: week.status,
    projectCount: projects.length,
    divisionCount: divisions.length,
    projects: projects.slice(0, 4).map((project) => ({
      slug: project.slug,
      title: project.title,
      category: project.division.name,
    })),
  };
}

export interface PublicProjectList {
  groups: string[];
  projects: ArenaProject[];
}

export async function getPublicProjects(): Promise<PublicProjectList> {
  const week = await currentWeekOrNull();
  // No week and "a week with nothing published yet" are the same thing to a
  // browser page: an empty list. One code path covers both.
  if (!week) return { groups: [], projects: [] };
  const [projects, divisions] = await Promise.all([
    listVisibleArenaProjects(),
    listActiveArenaDivisions(),
  ]);
  const opensAt = new Date(week.opensAt);
  const weekNo = isoWeekNumber(opensAt);
  const deadline = deadlineLabel(new Date(week.submissionDeadlineAt));
  // One batched skills query for the whole week (no N+1 per card).
  const skillRows = projects.length
    ? await getDb()
        .select({ projectId: projectSkills.projectId, name: skills.name })
        .from(projectSkills)
        .innerJoin(skills, eq(projectSkills.skillId, skills.id))
        .where(inArray(projectSkills.projectId, projects.map((project) => project.id)))
    : [];
  const skillsByProject = new Map<string, string[]>();
  for (const row of skillRows) {
    const list = skillsByProject.get(row.projectId) ?? [];
    list.push(row.name);
    skillsByProject.set(row.projectId, list);
  }
  const mapped: ArenaProject[] = projects.map((project) => ({
    ...toBaseProject(project, weekNo, deadline),
    skills: skillsByProject.get(project.id) ?? [],
  }));
  return { groups: divisions.map((division) => division.name), projects: mapped };
}

export async function getPublicProjectDetail(slug: string): Promise<ArenaProject | null> {
  let detail: Detail;
  try {
    detail = await getVisibleArenaProject({ slug });
  } catch {
    return null;
  }
  // The project's OWN week. Labelling an archived project with whatever week is
  // open today is how a finished brief came to advertise next Friday's deadline,
  // and how an ad-hoc week that ends on a Tuesday got a Friday next to it.
  const opensAt = new Date(detail.week.opensAt);
  const weekNo = isoWeekNumber(opensAt);
  const deadline = deadlineLabel(new Date(detail.week.submissionDeadlineAt));
  const currentWeek = await currentWeekOrNull().catch(() => null);
  const totalWeight = detail.rubric.reduce((sum, criterion) => sum + Number(criterion.weight), 0) || 1;
  return {
    slug: detail.slug,
    category: detail.division.name,
    group: detail.division.name,
    week: weekNo,
    title: detail.title,
    shortDescription: detail.shortDescription ?? "",
    caseBackground: detail.caseBackground ?? "",
    role: detail.roleDescription ?? "",
    mission: detail.mission ?? "",
    objective: detail.objective ? [detail.objective] : [],
    deliverables: detail.requirements.map((requirement) => ({
      id: requirement.id,
      title: requirement.label,
      description: requirement.instructions ?? undefined,
    })),
    skills: detail.skills.map((skill) => skill.name),
    resources: toProjectResources(detail.resources),
    difficulty: difficultyLabel(detail.difficulty),
    estimatedTime: estimatedLabel(detail.estimatedMinutes),
    deadlineLabel: deadline,
    rubric: detail.rubric.map((criterion) => ({
      id: criterion.id,
      label: criterion.name,
      weight: Math.round((Number(criterion.weight) / totalWeight) * 100),
      description: criterion.description ?? criterion.reviewInstruction ?? "",
    })),
    isThisWeek: currentWeek?.id === detail.week.id,
  };
}
