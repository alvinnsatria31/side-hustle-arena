'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArenaApiError, type ArenaErrorCode } from './arena-client';
import type { getOpsOverview } from '@/server/admin/overview';
import type {
  listAdminInventory,
  listAdminRedemptions,
  listAdminReviews,
  listAdminUsers,
  listAdminWeeks,
} from '@/server/admin/operations';

export type AdminOverview = Awaited<ReturnType<typeof getOpsOverview>>;
export type AdminWeek = Awaited<ReturnType<typeof listAdminWeeks>>[number];
export type AdminReviewRow = Awaited<ReturnType<typeof listAdminReviews>>[number];
export type AdminRedemption = Awaited<ReturnType<typeof listAdminRedemptions>>[number];
export type AdminInventory = Awaited<ReturnType<typeof listAdminInventory>>;
export type AdminUser = Awaited<ReturnType<typeof listAdminUsers>>[number];

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
