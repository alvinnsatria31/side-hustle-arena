'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArenaApiError, type ArenaErrorCode } from './arena-client';
import type { ParticipantOverview } from '@/server/arena/participant-service';
import type { MilestoneLadder } from '@/server/rewards/milestones';
import type { VoucherDelivery } from '@/server/rewards/voucher-push';

export type { ParticipantOverview };
export type ParticipantEnrollment = ParticipantOverview['history'][number];
export interface ParticipantInbox {
  items: Array<{ id: string; type: string; title: string; body: string | null; actionUrl: string | null; readAt: string | null; createdAt: string }>;
  /** Pass back as `cursor` to read older messages; null when there are none. */
  nextCursor: string | null;
  unread: number;
}

export async function participantRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error || !payload || !('data' in payload)) {
    throw new ArenaApiError((payload?.error?.code ?? 'INTERNAL_ERROR') as ArenaErrorCode, payload?.error?.message ?? 'Data belum dapat dimuat. Coba lagi.', response.status);
  }
  return payload.data as T;
}

export const getParticipantOverview = () => participantRequest<ParticipantOverview>('/api/arena/me');
export const getParticipantMilestones = () => participantRequest<{ ladder: MilestoneLadder }>('/api/arena/milestones');
export const takeParticipantReward = (slug: string, retryOf?: string | null) =>
  participantRequest<{ taken: { redemptionId: string; pointsSpent: number; delivery: VoucherDelivery | null } }>('/api/arena/milestones/take', { method: 'POST', body: JSON.stringify(retryOf ? { slug, retryOf } : { slug }) });
export const setParticipantAvatar = (avatarId: string) =>
  participantRequest<{ avatarId: string }>('/api/arena/me/avatar', { method: 'PUT', body: JSON.stringify({ avatarId }) });
export const getParticipantInbox = (unreadOnly = false, limit = 20, cursor?: string | null) =>
  participantRequest<ParticipantInbox>(`/api/arena/notifications?limit=${limit}${unreadOnly ? '&unread=1' : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
export const readParticipantInbox = (eventIds?: string[]) =>
  participantRequest<{ read: { marked: number } }>('/api/arena/notifications', { method: 'POST', body: JSON.stringify(eventIds ? { eventIds } : { all: true }) });

/** Privacy: Showcase consent and account deletion. Both act on the session's own user. */
export const getParticipantPrivacy = () =>
  participantRequest<{ showcaseConsent: boolean; showcaseConsentAt: string | null; showcaseConsentSource: string | null; accountDeleted: boolean }>('/api/arena/me/privacy');
export const setParticipantShowcaseConsent = (showcaseConsent: boolean) =>
  participantRequest<{ consented: boolean; consentedAt: string | null }>('/api/arena/me/privacy', { method: 'POST', body: JSON.stringify({ showcaseConsent }) });
export const deleteParticipantAccount = (confirm: string) =>
  participantRequest<{ deleted: boolean; anonymizedAt: string }>('/api/arena/me/privacy', { method: 'DELETE', body: JSON.stringify({ confirm }) });

// Ignore superseded responses when a filter changes or a mutation triggers a refresh.
export function useParticipantResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: true });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await loader();
      if (request === generation.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (request === generation.current) setState({ data: null, error: error instanceof Error ? error : new Error('Data belum dapat dimuat.'), loading: false });
    }
  }, [loader]);
  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { generation.current++; window.removeEventListener('focus', onFocus); };
  }, [refresh]);
  return { ...state, refresh };
}
