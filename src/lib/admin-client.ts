'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArenaApiError, type ArenaErrorCode } from './arena-client';
import type { getOpsOverview } from '@/server/admin/overview';
import type { EmailBucket, EmailOutboxRow, EmailOutboxSummary } from '@/server/notifications/outbox-admin';
import type {
  listAdminInventory,
  listAdminRedemptions,
  listAdminReviews,
  listAdminUsers,
  listAdminWeeks,
} from '@/server/admin/operations';
import type { adminJobCatalogue, listAutomationRuns } from '@/server/admin/jobs';
import type { listAdminDivisions, listAdminProjects } from '@/server/admin/content';
import type { previewProject } from '@/server/generation/service';

/** Every `Date` becomes an ISO string over the wire; pages format them themselves. */
type Serialized<T> = T extends Date ? string
  : T extends (infer Item)[] ? Serialized<Item>[]
  : T extends object ? { [K in keyof T]: Serialized<T[K]> }
  : T;

export type AdminOverview = Awaited<ReturnType<typeof getOpsOverview>>;
export type AdminWeek = Awaited<ReturnType<typeof listAdminWeeks>>[number];
export type AdminReviewRow = Awaited<ReturnType<typeof listAdminReviews>>[number];
export type AdminRedemption = Awaited<ReturnType<typeof listAdminRedemptions>>[number];
export type AdminInventory = Awaited<ReturnType<typeof listAdminInventory>>;
export type AdminUser = Awaited<ReturnType<typeof listAdminUsers>>[number];
/** Dates cross the wire as ISO strings; the page formats them itself. */
export type AdminEmailDelivery = Omit<EmailOutboxRow, 'availableAt' | 'firstAttemptAt' | 'sentAt' | 'failedAt' | 'leaseExpiresAt' | 'createdAt'> & {
  availableAt: string;
  firstAttemptAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  leaseExpiresAt: string | null;
  createdAt: string;
};
export type AdminJob = ReturnType<typeof adminJobCatalogue>[number];
export type AdminJobResult = { job: string; done: boolean; detail: Record<string, unknown>; durationMs: number };
export type AdminAutomationRun = Serialized<Awaited<ReturnType<typeof listAutomationRuns>>[number]>;
export type AdminProjectRow = Serialized<Awaited<ReturnType<typeof listAdminProjects>>[number]>;
export type AdminDivision = Serialized<Awaited<ReturnType<typeof listAdminDivisions>>[number]>;
export type AdminProjectDetail = Serialized<Awaited<ReturnType<typeof previewProject>>>;
export type { EmailBucket, EmailOutboxSummary };

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error || !payload || !('data' in payload)) {
    throw new ArenaApiError(
      (payload?.error?.code ?? 'INTERNAL_ERROR') as ArenaErrorCode,
      payload?.error?.message ?? 'Tindakan gagal. Coba lagi.',
      response.status,
    );
  }
  return payload.data as T;
}

/** Same superseded-response guard as the participant client, kept independent
 * since admin and participant surfaces have no reason to share a module. */
export function useAdminResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await loader();
      if (request === generation.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (request === generation.current) {
        setState({ data: null, error: error instanceof Error ? error : new Error('Data belum dapat dimuat.'), loading: false });
      }
    }
  }, [loader]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  return { ...state, refresh };
}

function qs(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

// ---------------------------------------------------------------- overview

export const getAdminOverview = () =>
  adminRequest<{ overview: AdminOverview }>('/api/internal/admin/overview').then((r) => r.overview);

export const setAdminFlag = (key: string, closed: boolean, message?: string | null) =>
  adminRequest('/api/internal/admin/flags', {
    method: 'POST',
    body: JSON.stringify({ key, closed, message: message ?? null }),
  });

// -------------------------------------------------------------------- weeks

export const listAdminWeeksClient = (params?: { limit?: number; offset?: number }) =>
  adminRequest<{ weeks: AdminWeek[] }>(`/api/internal/weeks${qs({ ...params })}`).then((r) => r.weeks);

export const closeAdminWeek = (input: { weekId: string; force?: boolean }) =>
  adminRequest('/api/internal/weeks/close', { method: 'POST', body: JSON.stringify(input) });

export const finalizeAdminWeek = (weekId: string) =>
  adminRequest('/api/internal/weeks/finalize', { method: 'POST', body: JSON.stringify({ weekId }) });

// ------------------------------------------------------------------ reviews

export const listAdminReviewsClient = (params?: { status?: string; limit?: number; offset?: number }) =>
  adminRequest<{ reviews: AdminReviewRow[] }>(`/api/internal/reviews/admin${qs({ ...params })}`).then((r) => r.reviews);

export const overrideAdminReview = (input: { reviewId: string; newScore: number; reason: string }) =>
  adminRequest('/api/internal/reviews/admin/override', { method: 'POST', body: JSON.stringify(input) });

export const rerunAdminReview = (input: { versionId: string; reason: string }) =>
  adminRequest('/api/internal/reviews/admin/rerun', { method: 'POST', body: JSON.stringify(input) });

export const voidAdminEnrollment = (input: { enrollmentId: string; reason: string }) =>
  adminRequest(`/api/internal/enrollments/${input.enrollmentId}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason: input.reason }),
  });

// -------------------------------------------------------------------- users

export const listAdminUsersClient = (params?: { q?: string; limit?: number; offset?: number }) =>
  adminRequest<{ users: AdminUser[] }>(`/api/internal/admin/users${qs({ ...params })}`).then((r) => r.users);

export const setAdminUserStatusClient = (input: { userId: string; status: 'ACTIVE' | 'SUSPENDED'; reason: string }) =>
  adminRequest(`/api/internal/admin/users/${input.userId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: input.status, reason: input.reason }),
  });

// ------------------------------------------------------------------ rewards

export const listAdminRedemptionsClient = (params?: { status?: string; limit?: number; offset?: number }) =>
  adminRequest<{ redemptions: AdminRedemption[] }>(`/api/internal/rewards${qs({ ...params })}`).then((r) => r.redemptions);

export const fulfillAdminRedemption = (input: { redemptionId: string; reference: string }) =>
  adminRequest(`/api/internal/rewards/${input.redemptionId}/fulfill`, {
    method: 'POST',
    body: JSON.stringify({ reference: input.reference }),
  });

export const reverseAdminRedemption = (input: { redemptionId: string; reason: string }) =>
  adminRequest(`/api/internal/rewards/${input.redemptionId}/reverse`, {
    method: 'POST',
    body: JSON.stringify({ reason: input.reason }),
  });

export const getAdminInventory = (params?: { limit?: number; offset?: number }) =>
  adminRequest<AdminInventory>(`/api/internal/rewards/inventory${qs({ ...params })}`);

export const setAdminRewardActive = (input: { rewardId: string; isActive: boolean; reason: string }) =>
  adminRequest('/api/internal/rewards/inventory', {
    method: 'POST',
    body: JSON.stringify({ action: 'catalog', ...input }),
  });

export const setAdminInventoryQuantity = (input: { periodId: string; quantityTotal: number; reason: string }) =>
  adminRequest('/api/internal/rewards/inventory', {
    method: 'POST',
    body: JSON.stringify({ action: 'quantity', ...input }),
  });

export const createAdminInventoryPeriod = (input: {
  rewardId: string;
  periodStart: string;
  periodEnd: string;
  quantityTotal: number;
  reason: string;
}) =>
  adminRequest('/api/internal/rewards/inventory', {
    method: 'POST',
    body: JSON.stringify({ action: 'period', ...input }),
  });

// ------------------------------------------------------------ email outbox

export const getAdminEmailOutbox = (params?: { bucket?: EmailBucket; limit?: number; offset?: number }) =>
  adminRequest<{ summary: EmailOutboxSummary; rows: AdminEmailDelivery[] }>(
    `/api/internal/admin/email-outbox${qs({ ...params })}`,
  );

export const requeueAdminEmailDelivery = (input: { deliveryId: string; reason: string }) =>
  adminRequest('/api/internal/admin/email-outbox/requeue', { method: 'POST', body: JSON.stringify(input) });

export const cancelAdminEmailDelivery = (input: { deliveryId: string; reason: string }) =>
  adminRequest('/api/internal/admin/email-outbox/cancel', { method: 'POST', body: JSON.stringify(input) });

// ------------------------------------------------------------- automation

export const getAdminJobs = () =>
  adminRequest<{ jobs: AdminJob[]; runs: AdminAutomationRun[] }>('/api/internal/admin/jobs');

export const runAdminJobClient = (job: string) =>
  adminRequest<{ result: AdminJobResult }>('/api/internal/admin/jobs', {
    method: 'POST',
    body: JSON.stringify({ job }),
  }).then((r) => r.result);

// --------------------------------------------------------------- projects

export const listAdminProjectsClient = (params?: { weekId?: string; divisionId?: string; status?: string; limit?: number; offset?: number }) =>
  adminRequest<{ projects: AdminProjectRow[] }>(`/api/internal/admin/projects${qs({ ...params })}`).then((r) => r.projects);

export const getAdminProject = (projectId: string) =>
  adminRequest<AdminProjectDetail>(`/api/internal/admin/projects/${projectId}`);

export const reviewAdminProject = (input: { projectId: string; action: 'approve' | 'veto' | 'regenerate'; reason: string }) =>
  adminRequest(`/api/internal/admin/projects/${input.projectId}/${input.action}`, {
    method: 'POST',
    body: JSON.stringify({ reason: input.reason }),
  });

export const editAdminProject = (input: { projectId: string; reason: string; package: unknown }) =>
  adminRequest(`/api/internal/admin/projects/${input.projectId}/edit`, {
    method: 'POST',
    body: JSON.stringify({ reason: input.reason, package: input.package }),
  });

export const scheduleAdminProject = (input: { projectId: string; scheduledPublishAt: string | null; reason: string }) =>
  adminRequest(`/api/internal/admin/projects/${input.projectId}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ scheduledPublishAt: input.scheduledPublishAt, reason: input.reason }),
  });

// -------------------------------------------------------------- divisions

export const listAdminDivisionsClient = () =>
  adminRequest<{ divisions: AdminDivision[] }>('/api/internal/admin/divisions').then((r) => r.divisions);

export const createAdminDivisionClient = (input: { slug: string; name: string; description?: string | null; isActive: boolean; sortOrder: number }) =>
  adminRequest('/api/internal/admin/divisions', { method: 'POST', body: JSON.stringify(input) });

export const updateAdminDivisionClient = (input: { divisionId: string; name?: string; description?: string | null; isActive?: boolean; sortOrder?: number }) =>
  adminRequest('/api/internal/admin/divisions', { method: 'PATCH', body: JSON.stringify(input) });

// ------------------------------------------------------ week orchestration

export const createAdminWeekClient = (input: { weekCode: string; title: string; opensAt: string; submissionDeadlineAt: string; previewAt?: string | null }) =>
  adminRequest<{ week: AdminWeek }>('/api/internal/weeks/create', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.week);

export const rescheduleAdminWeekClient = (input: { weekId: string; opensAt?: string; submissionDeadlineAt?: string; reason: string }) =>
  adminRequest('/api/internal/weeks/reschedule', { method: 'POST', body: JSON.stringify(input) });

export const generateAdminWeek = (input: { weekId: string; divisionId?: string }) =>
  adminRequest<{ weekId: string; provider: string; results: Array<Record<string, unknown>> }>('/api/internal/weeks/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const publishAdminWeek = (weekId: string) =>
  adminRequest<{ weekId: string; published: string[]; held: Array<{ projectId: string; reason: string }>; skipped?: string }>('/api/internal/weeks/publish', {
    method: 'POST',
    body: JSON.stringify({ weekId }),
  });
