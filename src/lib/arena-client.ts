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
  | 'SUBMISSION_ITEM_NOT_FOUND'
  | 'SUBMISSION_DEADLINE_PASSED'
  | 'SUBMISSION_REQUIREMENTS_INCOMPLETE'
  | 'FILE_LIMIT_EXCEEDED'
  | 'LINK_LIMIT_EXCEEDED'
  | 'FILE_TYPE_NOT_ALLOWED'
  | 'FILE_TOO_LARGE'
  | 'UPLOAD_INTENT_NOT_FOUND'
  | 'UPLOAD_INTENT_EXPIRED'
  | 'UPLOAD_VALIDATION_FAILED'
  | 'REVIEW_ATTEMPT_LIMIT_REACHED'
  | 'REVIEW_JOB_NOT_FOUND'
  | 'REVIEW_JOB_UNAVAILABLE'
  | 'REVIEW_VALIDATION_FAILED'
  | 'REVIEW_PROVIDER_FAILED'
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
  // DELETE endpoints answer 204 with no body — never treat that as failure.
  if (res.status === 204) return undefined as T;
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok || isFailure(payload)) {
    const code = (isFailure(payload) ? payload.error.code : 'INTERNAL_ERROR') as ArenaErrorCode;
    const message = isFailure(payload) ? payload.error.message : `Request failed (${res.status}).`;
    const details = isFailure(payload) ? payload.error.details : undefined;
    throw new ArenaApiError(code, message, res.status, details);
  }
  return (payload as ArenaSuccess<T>).data;
}

/* ---------- File-upload rules (mirror server schemas; server stays authoritative) ---------- */

export const MAX_FILES = 5;
export const MAX_LINKS = 5;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const FILE_PICKER_ACCEPT = Object.keys(ALLOWED_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');

export function mimeForFilename(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_FILE_TYPES[ext] ?? null;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export interface DraftItem {
  id: string;
  requirementId: string;
  itemType: 'FILE' | 'LINK';
  label: string | null;
  externalUrl: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
}

export interface ArenaSubmission {
  id: string;
  enrollmentId: string;
  status: string;
  explanation: string | null;
  notes: string | null;
  reviewAttemptsUsed: number;
  latestVersionId: string | null;
  items: DraftItem[];
}

export function getSubmission(enrollmentId: string): Promise<ArenaSubmission> {
  return request<ArenaSubmission>(`/api/arena/enrollments/${enrollmentId}/submission`);
}

export function patchSubmissionDraft(
  enrollmentId: string,
  draft: { explanation?: string | null; notes?: string | null },
): Promise<ArenaSubmission> {
  return request<ArenaSubmission>(`/api/arena/enrollments/${enrollmentId}/submission`, {
    method: 'PATCH',
    body: JSON.stringify(draft),
  });
}

export interface SubmitResult {
  version: {
    id: string;
    accessStatus: 'ACCESSIBLE' | 'FAILED' | string;
    reviewAttemptNumber: number | null;
  };
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  projectTitle: string;
  divisionName: string;
  finalScore: number;
  pointsAwarded: number;
  finalSubmittedAt: string | Date;
}

export interface LeaderboardResponse {
  weekCode: string;
  finalizedAt: string | Date | null;
  rows: LeaderboardEntry[];
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

export function getWeekCurrent(): Promise<WeekCurrent> {
  return request<WeekCurrent>('/api/arena/week/current');
}

export interface VisibleProject {
  id: string;
  slug: string;
  title: string;
}

export interface ProjectRequirement {
  id: string;
  label: string;
  type: 'FILE' | 'LINK' | 'TEXT';
  required: boolean;
  minItems: number;
  maxItems: number;
  instructions: string | null;
}

export interface VisibleProjectDetail extends VisibleProject {
  division: { id: string; slug: string; name: string };
  difficulty: string;
  estimatedMinutes: number | null;
  caseBackground: string | null;
  roleDescription: string | null;
  objective: string | null;
  skills: Array<{ slug: string; name: string }>;
  requirements: ProjectRequirement[];
}

export interface WeekCurrent {
  id: string;
  weekCode: string;
  status: string;
  submissionDeadlineAt: string;
}

export function getVisibleProject(slug: string): Promise<VisibleProject> {
  return request<VisibleProject>(`/api/arena/projects/${encodeURIComponent(slug)}`);
}

export function getVisibleProjectDetail(slug: string): Promise<VisibleProjectDetail> {
  return request<VisibleProjectDetail>(`/api/arena/projects/${encodeURIComponent(slug)}`);
}

export function getLeaderboard(week?: string): Promise<LeaderboardResponse> {
  const qs = week ? `?week=${encodeURIComponent(week)}` : '';
  return request<LeaderboardResponse>(`/api/arena/leaderboard${qs}`);
}

export type ArenaResult =
  | { sealed: true; weekStatus: string; reviewAttemptsUsed: number; submissionStatus: string }
  | { sealed: false; finalized: false }
  | {
      sealed: false;
      finalized: true;
      ranked: true;
      rank: number;
      weekCode: string;
      finalScore: number;
      pointsAwarded: number;
      summary: string | null;
      strengths: string[];
      improvements: string[];
      rubric: Array<{ label: string; score: number; max: number; feedback: string | null }>;
      skillsProven: string[];
      versionNumber: number;
      submittedAt: string | Date;
    }
  | { sealed: false; finalized: true; ranked: false };

export function getResult(enrollmentId: string): Promise<ArenaResult> {
  return request<ArenaResult>(`/api/arena/enrollments/${enrollmentId}/result`);
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

export function addSubmissionLink(
  enrollmentId: string,
  input: { requirementId: string; url: string; label?: string },
): Promise<SubmissionLinkResult> {
  return request<SubmissionLinkResult>(`/api/arena/enrollments/${enrollmentId}/submission/links`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function submitEnrollment(enrollmentId: string): Promise<SubmitResult> {
  return request<SubmitResult>(`/api/arena/enrollments/${enrollmentId}/submission/submit`, {
    method: 'POST',
  });
}

export interface UploadIntent {
  intentId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string | Date;
}

export function requestUploadIntent(
  enrollmentId: string,
  input: { requirementId: string; filename: string; mimeType: string; sizeBytes: number },
): Promise<UploadIntent> {
  return request<UploadIntent>(`/api/arena/enrollments/${enrollmentId}/submission/uploads/presign`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function finalizeUpload(enrollmentId: string, intentId: string): Promise<DraftItem> {
  return request<DraftItem>(`/api/arena/enrollments/${enrollmentId}/submission/uploads/${intentId}/finalize`, {
    method: 'POST',
  });
}

export function deleteSubmissionItem(enrollmentId: string, itemId: string): Promise<void> {
  return request<void>(
    `/api/arena/submission-items/${itemId}?enrollmentId=${encodeURIComponent(enrollmentId)}`,
    { method: 'DELETE' },
  );
}

export interface DownloadGrant {
  url: string;
  filename: string | null;
}

export function getDownloadGrant(enrollmentId: string, itemId: string): Promise<DownloadGrant> {
  return request<DownloadGrant>(
    `/api/arena/submission-items/${itemId}?enrollmentId=${encodeURIComponent(enrollmentId)}`,
  );
}

export function markNotificationsRead(eventIds: string[]): Promise<{ read: unknown }> {
  return request<{ read: unknown }>('/api/arena/notifications', {
    method: 'POST',
    body: JSON.stringify({ eventIds }),
  });
}
