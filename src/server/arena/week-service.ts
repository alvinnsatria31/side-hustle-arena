import type { ArenaDomainErrorCode } from "./errors";

export type WeekLifecycleStatus = "DRAFT" | "PREVIEW" | "SCHEDULED" | "OPEN" | "CLOSED" | "FINALIZING" | "FINALIZED" | "ARCHIVED" | "FAILED";

export type WeekCandidate = {
  id: string;
  weekCode?: string;
  status: WeekLifecycleStatus;
  opensAt: Date;
  submissionDeadlineAt: Date;
  closedAt?: Date | null;
  finalizationStartedAt?: Date | null;
  finalizedAt?: Date | null;
};

function openWeekPriority(week: WeekCandidate): number {
  const code = week.weekCode?.toUpperCase() ?? "";
  if (code.startsWith("ARENA-KICKOFF")) return 0;
  if (code.includes("GEN-TEST") || code.includes("E2E")) return 2;
  return 1;
}

function descendingDate(left: Date, right: Date): number {
  return right.getTime() - left.getTime();
}

function latestLifecycleDate(week: WeekCandidate): Date {
  return week.finalizedAt ?? week.finalizationStartedAt ?? week.closedAt ?? week.submissionDeadlineAt;
}

/**
 * Resolves a read-only current-week view without mutating lifecycle status:
 * active OPEN first, then the next SCHEDULED/PREVIEW week, then the most
 * recently ended CLOSED/FINALIZING/FINALIZED week.
 */
export function resolveCurrentWeekFromCandidates(candidates: WeekCandidate[], now = new Date()): WeekCandidate | null {
  const open = candidates.filter((week) => week.status === "OPEN" && week.opensAt <= now)
    .sort((left, right) => openWeekPriority(left) - openWeekPriority(right) || descendingDate(left.opensAt, right.opensAt));
  if (open[0]) return open[0];

  const upcoming = candidates.filter((week) => (week.status === "SCHEDULED" || week.status === "PREVIEW") && week.opensAt > now)
    .sort((left, right) => left.opensAt.getTime() - right.opensAt.getTime());
  if (upcoming[0]) return upcoming[0];

  const ended = candidates.filter((week) => week.status === "CLOSED" || week.status === "FINALIZING" || week.status === "FINALIZED")
    .sort((left, right) => descendingDate(latestLifecycleDate(left), latestLifecycleDate(right)));
  return ended[0] ?? null;
}

export function getWeekSelectionState(week: WeekCandidate | null, now = new Date()): { canSelect: boolean; reason?: ArenaDomainErrorCode } {
  if (!week) return { canSelect: false, reason: "WEEK_NOT_FOUND" };
  if (week.status === "CLOSED" || week.status === "FINALIZING" || week.status === "FINALIZED") return { canSelect: false, reason: "WEEK_CLOSED" };
  if (week.status !== "OPEN" || week.opensAt > now) return { canSelect: false, reason: "WEEK_NOT_OPEN" };
  if (now >= week.submissionDeadlineAt) return { canSelect: false, reason: "SELECTION_DEADLINE_PASSED" };
  return { canSelect: true };
}
