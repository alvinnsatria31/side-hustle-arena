import "server-only";
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/server/db/client";
import { enrollments, projectSkills, projectSubmissionRequirements, skills, weekRules } from "@/server/db/schema";
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
 * - points stay absent; participant totals come from non-voided enrollments.
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
    // Raw storage keys / provider URLs never reach the browser: cards render
    // the proxy route, which streams private COS bytes server-side.
    coverImageUrl: project.coverImageUrl ? `/api/arena/covers/${project.slug}` : null,
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

/**
 * The point ladder a participant can actually earn this week.
 *
 * Read from `arena.week_rules`, never assumed: the columns carry defaults, but
 * a week is free to run a different ladder and the landing page promises what
 * that week pays. Absent when the row has not been written, which is the only
 * honest way to render "no points announced yet".
 */
export interface PublicWeekPoints {
  completion: number;
  rank1: number;
  rank2: number;
  rank3: number;
}

export interface PublicArenaHome {
  weekNo: number;
  weekLabel: string;
  deadline: string;
  deadlineAt: string;
  canSelect: boolean;
  status: string;
  projectCount: number;
  divisionCount: number;
  points: PublicWeekPoints | null;
  projects: Array<{
    slug: string;
    title: string;
    category: string;
    /** Division slug — drives the per-category mini visual on the landing card. */
    categorySlug: string;
    estimatedTime: string;
    deliverable: string;
    participantCount: number;
    /** Proxy route, or null when the brief has no generated cover. */
    coverImageUrl: string | null;
  }>;
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

/**
 * Public readers below are cached for 5 minutes.
 *
 * These pages were `force-dynamic`: every pageview fired 3–5 queries at Neon
 * (weeks + projects + divisions + skills + rewards) for content that changes
 * weekly. Under traffic that burns straight through Neon's data-transfer
 * quota and takes every DB-backed page down at once. A 5-minute stale window
 * is irrelevant for weekly drops; enrollment state stays live because it
 * resolves client-side. Errors are never cached, so pages recover on their
 * own once the database is reachable again.
 */
const PUBLIC_TTL_SECONDS = 300;

async function fetchPublicArenaHome(): Promise<PublicArenaHome | null> {
  const week = await currentWeekOrNull();
  if (!week) return null;
  const [projects, divisions] = await Promise.all([
    listVisibleArenaProjects(),
    listActiveArenaDivisions(),
  ]);
  const opensAt = new Date(week.opensAt);
  const weekNo = isoWeekNumber(opensAt);
  const projectIds = projects.map((project) => project.id);
  const [participantRows, deliverableRows] = projectIds.length
    ? await Promise.all([
        getDb()
          .select({ projectId: enrollments.projectId, participantCount: count() })
          .from(enrollments)
          .where(and(inArray(enrollments.projectId, projectIds), ne(enrollments.status, "VOIDED")))
          .groupBy(enrollments.projectId),
        getDb()
          .select({ projectId: projectSubmissionRequirements.projectId, label: projectSubmissionRequirements.label })
          .from(projectSubmissionRequirements)
          .where(inArray(projectSubmissionRequirements.projectId, projectIds))
          .orderBy(asc(projectSubmissionRequirements.sortOrder)),
      ])
    : [[], []];
  // The week's own ladder. A week with no rules row pays nothing this reader
  // knows about, so `points` stays null and the page says nothing about points.
  const [rules] = await getDb()
    .select({
      completion: weekRules.completionPoints,
      rank1: weekRules.rank1Points,
      rank2: weekRules.rank2Points,
      rank3: weekRules.rank3Points,
    })
    .from(weekRules)
    .where(eq(weekRules.weekId, week.id));
  const participantsByProject = new Map(participantRows.map((row) => [row.projectId, row.participantCount]));
  const deliverableByProject = new Map<string, string>();
  for (const row of deliverableRows) {
    if (!deliverableByProject.has(row.projectId)) deliverableByProject.set(row.projectId, row.label);
  }
  const deadlineAt = new Date(week.submissionDeadlineAt);
  return {
    weekNo,
    weekLabel: `WEEK ${weekNo} · ${monthDayLabel(opensAt)}`,
    deadline: deadlineLabel(deadlineAt),
    deadlineAt: deadlineAt.toISOString(),
    canSelect: week.selection.canSelect,
    status: week.status,
    projectCount: projects.length,
    divisionCount: divisions.length,
    points: rules ?? null,
    projects: projects.slice(0, 3).map((project) => ({
      slug: project.slug,
      title: project.title,
      category: project.division.name,
      categorySlug: project.division.slug,
      estimatedTime: estimatedLabel(project.estimatedMinutes),
      deliverable: deliverableByProject.get(project.id) ?? project.shortDescription ?? "Lihat detail project",
      participantCount: participantsByProject.get(project.id) ?? 0,
      coverImageUrl: project.coverImageUrl ? `/api/arena/covers/${project.slug}` : null,
    })),
  };
}

export const getPublicArenaHome = unstable_cache(fetchPublicArenaHome, ["arena-public-home"], {
  revalidate: PUBLIC_TTL_SECONDS,
});

export interface PublicProjectList {
  groups: string[];
  projects: ArenaProject[];
}

async function fetchPublicProjects(): Promise<PublicProjectList> {
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
  // Real participant totals, one batched query (same source the landing
  // board uses: non-voided enrollments). Cards render "N Peserta Aktif"
  // from this — never a mock number.
  const participantRows = projects.length
    ? await getDb()
        .select({ projectId: enrollments.projectId, participantCount: count() })
        .from(enrollments)
        .where(and(inArray(enrollments.projectId, projects.map((project) => project.id)), ne(enrollments.status, "VOIDED")))
        .groupBy(enrollments.projectId)
    : [];
  const participantsByProject = new Map(participantRows.map((row) => [row.projectId, row.participantCount]));
  const mapped: ArenaProject[] = projects.map((project) => ({
    ...toBaseProject(project, weekNo, deadline),
    skills: skillsByProject.get(project.id) ?? [],
    participants: participantsByProject.get(project.id) ?? 0,
  }));
  return { groups: divisions.map((division) => division.name), projects: mapped };
}

export const getPublicProjects = unstable_cache(fetchPublicProjects, ["arena-public-projects"], {
  revalidate: PUBLIC_TTL_SECONDS,
});

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
    coverImageUrl: detail.coverImageUrl ? `/api/arena/covers/${detail.slug}` : null,
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
