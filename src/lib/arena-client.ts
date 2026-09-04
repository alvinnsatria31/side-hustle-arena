'use client';

/**
 * Phase 9b browser client (thin, typed).
 *
 * Untuk apa: satu-satunya cara component `/app/*` ngomong ke backend Arena.
 * Menggantikan `DemoProvider` (localStorage `sk-demo-state-v1`) dengan
 * session cookie Arena (`ARENA_SESSION_COOKIE`) via API yang sudah ada.
 *
 * Kontrak:
 * - sukses: `{ data: T }` (lihat `src/server/arena/http.ts` → `arenaData`)
 * - gagal: `{ error: { code, message, details? } }` + status HTTP
 * - anon: 401 `{ error: { code: "UNAUTHORIZED" } }`
 * - semua request same-origin + `credentials: "include"` (cookie ikut)
 */

export type ArenaErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'WEEK_NOT_FOUND'
  | 'WEEK_NOT_OPEN'
  | 'WEEK_CLOSED'
  | 'SELECTION_DEADLINE_PASSED'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_NOT_PUBLISHED'
  | 'PROJECT_NOT_IN_ACTIVE_WEEK'
  | 'ALREADY_ENROLLED_THIS_WEEK'
  | 'ENROLLMENT_NOT_FOUND'
  | 'SUBMISSION_NOT_FOUND'
  | 'SUBMISSION_DEADLINE_PASSED'
  | 'REVIEW_ATTEMPT_LIMIT_REACHED'
  | 'WEEK_NOT_READY'
  | 'WEEK_NOT_FINALIZED'
  | 'FEATURE_CLOSED'
  | 'STORAGE_NOT_CONFIGURED'
  | 'INTERNAL_ERROR';

export class ArenaApiError extends Error {
  readonly code: ArenaErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ArenaErrorCode, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ArenaApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ArenaSuccess<T> {
  data: T;
}

interface ArenaFailure {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

function isFailure(payload: unknown): payload is ArenaFailure {
  if (typeof payload !== 'object' || payload === null) return false;
  if (!('error' in payload)) return false;
  const err = (payload as { error: unknown }).error;
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok || isFailure(payload)) {
    const code = (isFailure(payload) ? payload.error.code : 'INTERNAL_ERROR') as ArenaErrorCode;
    const message = isFailure(payload) ? payload.error.message : `Request failed (${res.status}).`;
    const details = isFailure(payload) ? payload.error.details : undefined;
    throw new ArenaApiError(code, message, res.status, details);
  }
  return (payload as ArenaSuccess<T>).data;
}

/* ---------- Types (ringkas, mengikuti service backend) ---------- */

export interface ArenaEnrollment {
  id: string;
  userId: string;
  weekId: string;
  projectId: string;
  status: string;
  selectedAt: string | Date;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
}

export type WorkspaceStep = 'BRIEF' | 'PLAN' | 'WORK' | 'REVIEW' | 'SUBMIT';

export interface WorkspaceProgress {
  enrollmentId: string;
  currentStep: WorkspaceStep | null;
  planText: string | null;
  tools: string[] | null;
  taskBreakdown: Array<{ title: string; done: boolean }> | null;
  notes: string | null;
  reviewChecklist: Array<{ label: string; done: boolean }> | null;
  updatedAt?: string | Date;
}

export type WorkspacePatch = Partial<
  Pick<WorkspaceProgress, 'currentStep' | 'planText' | 'tools' | 'taskBreakdown' | 'notes' | 'reviewChecklist'>
>;

export interface SubmissionLinkResult {
  id: string;
  url: string;
}

export interface SubmitResult {
  version: {
    id: string;
    accessStatus: 'ACCESSIBLE' | 'FAILED' | string;
    reviewAttemptNumber: number | null;
  };
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  score: number;
  rank: number;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | Date | null;
  createdAt: string | Date;
}

/* ---------- Reads ---------- */

export function getCurrentEnrollment(): Promise<ArenaEnrollment | null> {
  return request<ArenaEnrollment | null>('/api/arena/enrollments/current');
}

export function getWorkspace(enrollmentId: string): Promise<WorkspaceProgress | null> {
  return request<WorkspaceProgress | null>(`/api/arena/enrollments/${enrollmentId}/workspace`);
}

export function getWeekCurrent(): Promise<unknown> {
  return request<unknown>('/api/arena/week/current');
}

export interface VisibleProject {
  id: string;
  slug: string;
  title: string;
}

export function getVisibleProject(slug: string): Promise<VisibleProject> {
  return request<VisibleProject>(`/api/arena/projects/${encodeURIComponent(slug)}`);
}

export function getLeaderboard(week?: string): Promise<LeaderboardEntry[]> {
  const qs = week ? `?week=${encodeURIComponent(week)}` : '';
  return request<LeaderboardEntry[]>(`/api/arena/leaderboard${qs}`);
}

export function getNotifications(opts?: { unreadOnly?: boolean; limit?: number }): Promise<{
  items: NotificationItem[];
  unread: number;
}> {
  const params = new URLSearchParams();
  if (opts?.unreadOnly) params.set('unread', '1');
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.size > 0 ? `?${params.toString()}` : '';
  return request<{ items: NotificationItem[]; unread: number }>(`/api/arena/notifications${qs}`);
}

export function getMilestones(): Promise<{ ladder: unknown }> {
  return request<{ ladder: unknown }>('/api/arena/milestones');
}

/* ---------- Writes (semua butuh origin same-site, lihat hasAllowedMutationOrigin) ---------- */

export function selectProject(projectId: string): Promise<{ enrollment: ArenaEnrollment; created: boolean }> {
  return request<{ enrollment: ArenaEnrollment; created: boolean }>('/api/arena/enrollments', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export function patchWorkspace(enrollmentId: string, patch: WorkspacePatch): Promise<WorkspaceProgress> {
  return request<WorkspaceProgress>(`/api/arena/enrollments/${enrollmentId}/workspace`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function addSubmissionLink(enrollmentId: string, url: string): Promise<SubmissionLinkResult> {
  return request<SubmissionLinkResult>(`/api/arena/enrollments/${enrollmentId}/submission/links`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function submitEnrollment(enrollmentId: string): Promise<SubmitResult> {
  return request<SubmitResult>(`/api/arena/enrollments/${enrollmentId}/submission/submit`, {
    method: 'POST',
  });
}

export function markNotificationsRead(eventIds: string[]): Promise<{ read: unknown }> {
  return request<{ read: unknown }>('/api/arena/notifications', {
    method: 'POST',
    body: JSON.stringify({ eventIds }),
  });
}
