import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { projectSkills, skills } from "@/server/db/schema";
import { getCurrentArenaWeek, getVisibleArenaProject, listActiveArenaDivisions, listVisibleArenaProjects } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";
import type { ArenaProject, ProjectDifficulty } from "@/types/project";

/**
 * Public read seam (Phase 9a): backend rows → the view models the approved
 * components already render. Visuals stay frozen; only data sources move.
 *
 * Honest mappings (no invented numbers):
 * - points/participants stay ABSENT (per-project points and live counters
 *   were mock-only; PRD pays points by rank, not by project).
 * - difficulty "STANDARD" is the only band the schema knows today → shown as
 *   Intermediate until the generator phase ships real bands.
 * - week number is the ISO week of opensAt; deadline label renders the real
 *   Friday 23:59 WIB timestamp from the database.
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

export function deadlineLabel(date: Date): string {
  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" }).format(date);
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(date);
  return `${weekday} · ${time}`;
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
  const week = await getCurrentArenaWeek().catch(() => null);
  const opensAt = week ? new Date(week.opensAt) : new Date();
  const weekNo = isoWeekNumber(opensAt);
  const deadline = week ? deadlineLabel(new Date(week.submissionDeadlineAt)) : "";
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
    resources: [],
    difficulty: difficultyLabel(detail.difficulty),
    estimatedTime: estimatedLabel(detail.estimatedMinutes),
    deadlineLabel: deadline,
    rubric: detail.rubric.map((criterion) => ({
      id: criterion.id,
      label: criterion.name,
      weight: Math.round((Number(criterion.weight) / totalWeight) * 100),
      description: criterion.description ?? criterion.reviewInstruction ?? "",
    })),
    isThisWeek: true,
  };
}
