import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  divisions,
  projects,
  projectSkills,
  skillEvidence,
  skills,
  users,
  weeklyRankings,
  weeks,
} from "@/server/db/schema";

type Db = ReturnType<typeof getDb>;

/**
 * Public Weekly Spotlight (PRD §56 surface, §103 publication rule).
 *
 * Until now this was the last Arena surface still served from `data/mock` — it
 * published invented winners, participants and scores to every visitor. It now
 * reads finalized results, and shows nothing when there are none.
 *
 * WHAT IS PUBLISHED, AND WHY ONLY THIS
 *
 * PRD §103 publishes "final score, leaderboard and points" after finalization,
 * and `listWeekLeaderboard` already puts name + project + division + score in
 * public view. The spotlight is a richer read of those same already-public
 * facts, plus the project's own brief — which is public on the project page.
 *
 * Deliberately NOT published, because nothing establishes them as public:
 *
 * - reviewer feedback and `reviews.summary` (written for the participant);
 * - `skill_evidence.evidence_summary` (quotes the participant's own work);
 * - submitted files, which have no permanent public URL by design.
 *
 * The mock's per-participant "process" narrative has no honest source at all —
 * nobody records how a participant worked. It is dropped rather than invented;
 * a real case study needs participant consent and a place to write it, which is
 * a product decision, not a query.
 *
 * CONSENT
 *
 * Every read here is gated on `users.showcase_consent_at`. Ranking well is not
 * agreement to be featured, and this surface names a person and shows their
 * face — so it is private by default and published only on a positive,
 * revocable act. A participant who has not opted in simply is not here; the
 * page says how many entries are withheld rather than silently showing fewer.
 * See `showcase-consent.ts` for the rule and why the leaderboard differs.
 */

/** Ranks 1..N are all "top projects"; the page features rank 1 and lists the rest. */
const SPOTLIGHT_RANK_LIMIT = 4;

export interface SpotlightEntry {
  /** Stable and shareable, with no identity in it: `w36-2026-rank-1`. */
  slug: string;
  weekCode: string;
  weekOpensAt: Date;
  finalizedAt: Date | null;
  rank: number;
  finalScore: number;
  pointsAwarded: number;
  participantName: string;
  avatarId: string | null;
  divisionName: string;
  projectSlug: string;
  projectTitle: string;
  projectShortDescription: string | null;
  skillsProven: string[];
}

export interface SpotlightDetail extends SpotlightEntry {
  caseBackground: string | null;
  roleDescription: string | null;
  mission: string | null;
  objective: string | null;
}

export function spotlightSlug(weekCode: string, rank: number): string {
  return `${weekCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-rank-${rank}`;
}

/**
 * A participant with no display name on file is shown as "Peserta Arena" rather
 * than as their auth subject — a subject is an internal identifier and must not
 * reach a public page.
 */
function participantName(displayName: string | null): string {
  return displayName?.trim() || "Peserta Arena";
}

async function loadEntries(
  where: ReturnType<typeof eq>,
  limit: number,
  db: Db,
): Promise<Array<SpotlightDetail>> {
  const rows = await db
    .select({
      weekCode: weeks.weekCode,
      weekOpensAt: weeks.opensAt,
      finalizedAt: weeks.finalizedAt,
      rank: weeklyRankings.rank,
      finalScore: weeklyRankings.finalScore,
      pointsAwarded: weeklyRankings.pointsAwarded,
      reviewId: weeklyRankings.reviewId,
      displayName: users.displayNameCache,
      avatarId: users.avatarId,
      divisionName: divisions.name,
      projectId: projects.id,
      projectSlug: projects.slug,
      projectTitle: projects.title,
      projectShortDescription: projects.shortDescription,
      caseBackground: projects.caseBackground,
      roleDescription: projects.roleDescription,
      mission: projects.mission,
      objective: projects.objective,
    })
    .from(weeklyRankings)
    .innerJoin(weeks, and(eq(weeks.id, weeklyRankings.weekId), eq(weeks.status, "FINALIZED")))
    .innerJoin(users, and(
      eq(users.id, weeklyRankings.userId),
      // The consent gate, in the join rather than in a filter afterwards: a
      // non-consenting participant is never loaded, so no later code path can
      // accidentally render one.
      isNotNull(users.showcaseConsentAt),
      isNull(users.anonymizedAt),
      eq(users.status, "ACTIVE"),
    ))
    .innerJoin(projects, eq(projects.id, weeklyRankings.projectId))
    .innerJoin(divisions, eq(divisions.id, projects.divisionId))
    .where(where)
    .orderBy(desc(weeks.opensAt), asc(weeklyRankings.rank))
    .limit(limit);

  if (!rows.length) return [];

  // Skills the review actually evidenced for this participant. Only the skill
  // NAME travels; the evidence summary quotes their work and stays private.
  const evidenced = await db
    .select({ reviewId: skillEvidence.reviewId, name: skills.name })
    .from(skillEvidence)
    .innerJoin(skills, eq(skills.id, skillEvidence.skillId))
    .where(inArray(skillEvidence.reviewId, rows.map((row) => row.reviewId)))
    .orderBy(asc(skills.name));

  // Fallback for projects that map no skills: the project's own declared skills,
  // which are already public on the project page.
  const declared = await db
    .select({ projectId: projectSkills.projectId, name: skills.name })
    .from(projectSkills)
    .innerJoin(skills, eq(skills.id, projectSkills.skillId))
    .where(inArray(projectSkills.projectId, rows.map((row) => row.projectId)))
    .orderBy(asc(skills.name));

  const byReview = new Map<string, string[]>();
  for (const row of evidenced) byReview.set(row.reviewId, [...(byReview.get(row.reviewId) ?? []), row.name]);
  const byProject = new Map<string, string[]>();
  for (const row of declared) byProject.set(row.projectId, [...(byProject.get(row.projectId) ?? []), row.name]);

  return rows.map((row) => ({
    slug: spotlightSlug(row.weekCode, row.rank),
    weekCode: row.weekCode,
    weekOpensAt: row.weekOpensAt,
    finalizedAt: row.finalizedAt,
    rank: row.rank,
    finalScore: Math.round(Number(row.finalScore)),
    pointsAwarded: row.pointsAwarded,
    participantName: participantName(row.displayName),
    avatarId: row.avatarId,
    divisionName: row.divisionName,
    projectSlug: row.projectSlug,
    projectTitle: row.projectTitle,
    projectShortDescription: row.projectShortDescription,
    skillsProven: byReview.get(row.reviewId) ?? byProject.get(row.projectId) ?? [],
    caseBackground: row.caseBackground,
    roleDescription: row.roleDescription,
    mission: row.mission,
    objective: row.objective,
  }));
}

/**
 * The most recently finalized week's top ranks, from participants who opted in.
 * Returns an empty list before the first finalization — the page says so rather
 * than inventing a winner — and `withheld` counts the ranked participants who
 * have not consented, so an empty showcase is explained rather than mysterious.
 */
export async function getLatestSpotlight(db: Db = getDb()): Promise<SpotlightDetail[]> {
  return (await getLatestSpotlightWithConsent(db)).entries;
}

export async function getLatestSpotlightWithConsent(db: Db = getDb()): Promise<{ entries: SpotlightDetail[]; withheld: number }> {
  const [latest] = await db
    .select({ id: weeks.id })
    .from(weeks)
    .where(eq(weeks.status, "FINALIZED"))
    // NULLS LAST is load-bearing: Postgres sorts NULLs FIRST under DESC, so a
    // week marked FINALIZED without a finalization timestamp would be picked as
    // the most recent one and the Showcase would feature the wrong week.
    .orderBy(sql`${weeks.finalizedAt} desc nulls last`, desc(weeks.opensAt))
    .limit(1);
  if (!latest) return { entries: [], withheld: 0 };
  const entries = await loadEntries(eq(weeklyRankings.weekId, latest.id), SPOTLIGHT_RANK_LIMIT, db);
  const [ranked] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(weeklyRankings)
    .where(and(eq(weeklyRankings.weekId, latest.id), lte(weeklyRankings.rank, SPOTLIGHT_RANK_LIMIT)));
  return { entries, withheld: Math.max(0, (ranked?.count ?? 0) - entries.length) };
}

export async function getSpotlightEntry(slug: string, db: Db = getDb()): Promise<SpotlightDetail | null> {
  const match = /^(.*)-rank-(\d+)$/.exec(slug);
  if (!match) return null;
  const rank = Number(match[2]);
  if (!Number.isInteger(rank) || rank < 1) return null;
  // The slug carries a normalised week code, so resolve the week by comparing
  // normalised codes rather than trusting the URL to be the stored spelling.
  const finalized = await db
    .select({ id: weeks.id, weekCode: weeks.weekCode })
    .from(weeks)
    .where(eq(weeks.status, "FINALIZED"));
  const week = finalized.find((row) => spotlightSlug(row.weekCode, rank) === slug);
  if (!week) return null;
  const [entry] = await loadEntries(
    and(eq(weeklyRankings.weekId, week.id), eq(weeklyRankings.rank, rank))!,
    1,
    db,
  );
  return entry ?? null;
}

export interface SpotlightHistoryRow {
  weekCode: string;
  opensAt: Date;
  winnerName: string;
  winnerProject: string;
  finalScore: number;
  slug: string;
}

/** One row per finalized week, newest first: the rank-1 entry of each. */
export async function listSpotlightHistory(limit = 8, db: Db = getDb()): Promise<SpotlightHistoryRow[]> {
  const rows = await db
    .select({
      weekCode: weeks.weekCode,
      opensAt: weeks.opensAt,
      displayName: users.displayNameCache,
      projectTitle: projects.title,
      finalScore: weeklyRankings.finalScore,
    })
    .from(weeklyRankings)
    .innerJoin(weeks, and(eq(weeks.id, weeklyRankings.weekId), eq(weeks.status, "FINALIZED")))
    .innerJoin(users, and(
      eq(users.id, weeklyRankings.userId),
      isNotNull(users.showcaseConsentAt),
      isNull(users.anonymizedAt),
      eq(users.status, "ACTIVE"),
    ))
    .innerJoin(projects, eq(projects.id, weeklyRankings.projectId))
    .where(eq(weeklyRankings.rank, 1))
    .orderBy(desc(weeks.opensAt))
    .limit(Math.min(Math.max(limit, 1), 52));

  return rows.map((row) => ({
    weekCode: row.weekCode,
    opensAt: row.opensAt,
    winnerName: participantName(row.displayName),
    winnerProject: row.projectTitle,
    finalScore: Math.round(Number(row.finalScore)),
    slug: spotlightSlug(row.weekCode, 1),
  }));
}
