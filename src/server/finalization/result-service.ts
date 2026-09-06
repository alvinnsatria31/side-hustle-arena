import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  enrollments,
  projectRubricCriteria,
  reviewScores,
  reviews,
  skillEvidence,
  skills,
  submissionVersions,
  submissions,
  weeklyRankings,
  weeks,
} from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";

/**
 * Phase 9b user-facing result (PRD §33: hasil disegel sampai finalisasi).
 *
 * Untuk apa: satu-satunya sumber kebenaran layar Result. Tidak ada skor
 * mock, tidak ada tebakan:
 * - week belum FINALIZED → `{ sealed: true }` (user lihat status + sisa
 *   attempts, bukan skor).
 * - FINALIZED tapi user tidak masuk ranking (tidak submit / tidak eligible /
 *   void) → `{ finalized: true, ranked: false }`.
 * - Masuk ranking → skor + rubrik + skills + poin dari baris final resmi.
 */
export async function getArenaResult({ userId, enrollmentId, db = getDb() }: { userId: string; enrollmentId: string; db?: ReturnType<typeof getDb> }) {
  const enrollment = (
    await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, userId)))
  )[0];
  if (!enrollment) throw new ArenaDomainError("ENROLLMENT_NOT_FOUND", "Enrollment not found.");

  const week = (await db.select().from(weeks).where(eq(weeks.id, enrollment.weekId)))[0];
  if (!week) throw new ArenaDomainError("WEEK_NOT_FOUND", "No current Arena week is available.");

  const submission = (
    await db.select().from(submissions).where(eq(submissions.enrollmentId, enrollment.id))
  )[0];

  if (week.status !== "FINALIZED" && week.status !== "ARCHIVED") {
    return {
      sealed: true as const,
      weekStatus: week.status,
      reviewAttemptsUsed: submission?.reviewAttemptsUsed ?? 0,
      submissionStatus: submission?.status ?? "NONE",
    };
  }

  const rankRow = (
    await db
      .select()
      .from(weeklyRankings)
      .where(and(eq(weeklyRankings.weekId, week.id), eq(weeklyRankings.userId, userId)))
  )[0];

  if (!rankRow) {
    return { sealed: false as const, finalized: true as const, ranked: false as const };
  }

  const review = (await db.select().from(reviews).where(eq(reviews.id, rankRow.reviewId)))[0];
  if (!review) return { sealed: false as const, finalized: true as const, ranked: false as const };

  const [scoreRows, skillRows, versionRows] = await Promise.all([
    db
      .select({
        label: projectRubricCriteria.name,
        score: reviewScores.rawScore,
        max: reviewScores.maxScore,
        feedback: reviewScores.feedback,
        sortOrder: projectRubricCriteria.sortOrder,
        name: projectRubricCriteria.name,
      })
      .from(reviewScores)
      .innerJoin(projectRubricCriteria, eq(reviewScores.rubricCriterionId, projectRubricCriteria.id))
      .where(eq(reviewScores.reviewId, review.id))
      .orderBy(asc(projectRubricCriteria.sortOrder), asc(projectRubricCriteria.name)),
    db
      .select({ name: skills.name })
      .from(skillEvidence)
      .innerJoin(skills, eq(skillEvidence.skillId, skills.id))
      .where(eq(skillEvidence.reviewId, review.id))
      .orderBy(asc(skills.name)),
    db
      .select()
      .from(submissionVersions)
      .where(eq(submissionVersions.id, rankRow.submissionVersionId))
      .limit(1),
  ]);

  const asStrings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  return {
    sealed: false as const,
    finalized: true as const,
    ranked: true as const,
    rank: rankRow.rank,
    weekCode: week.weekCode,
    finalScore: Number(rankRow.finalScore),
    pointsAwarded: rankRow.pointsAwarded,
    summary: review.summary,
    strengths: asStrings(review.strengths),
    improvements: asStrings(review.improvements),
    rubric: scoreRows.map((row) => ({
      label: row.label,
      score: Number(row.score),
      max: Number(row.max),
      feedback: row.feedback,
    })),
    skillsProven: skillRows.map((row) => row.name),
    versionNumber: versionRows[0]?.versionNumber ?? 0,
    submittedAt: versionRows[0]?.submittedAt ?? rankRow.finalSubmittedAt,
  };
}

/** Versi terbaru yang bisa di-submit ulang: attempts terpakai + status draft. */
export async function getArenaResultStatus({ userId, enrollmentId }: { userId: string; enrollmentId: string }) {
  const db = getDb();
  const enrollment = (
    await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, userId)))
  )[0];
  if (!enrollment) throw new ArenaDomainError("ENROLLMENT_NOT_FOUND", "Enrollment not found.");
  const submission = (
    await db.select().from(submissions).where(eq(submissions.enrollmentId, enrollment.id))
  )[0];
  const versions = submission
    ? await db
        .select()
        .from(submissionVersions)
        .where(eq(submissionVersions.submissionId, submission.id))
        .orderBy(desc(submissionVersions.versionNumber))
        .limit(5)
    : [];
  return {
    reviewAttemptsUsed: submission?.reviewAttemptsUsed ?? 0,
    submissionStatus: submission?.status ?? "NONE",
    versions: versions.map((version) => ({
      versionNumber: version.versionNumber,
      accessStatus: version.accessStatus,
      reviewAttemptNumber: version.reviewAttemptNumber,
      reviewStatus: version.reviewStatus,
      submittedAt: version.submittedAt,
    })),
  };
}
