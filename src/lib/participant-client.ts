'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArenaApiError, type ArenaErrorCode } from './arena-client';
import type { ParticipantOverview } from '@/server/arena/participant-service';
import type { MilestoneLadder } from '@/server/rewards/milestones';

export type { ParticipantOverview };
export type ParticipantEnrollment = ParticipantOverview['history'][number];
export interface ParticipantInbox {
  items: Array<{ id: string; type: string; title: string; body: string | null; actionUrl: string | null; readAt: string | null; createdAt: string }>;
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
export const takeParticipantReward = (slug: string) => participantRequest('/api/arena/milestones/take', { method: 'POST', body: JSON.stringify({ slug }) });
export const getParticipantInbox = (unreadOnly = false, limit = 20) => participantRequest<ParticipantInbox>(`/api/arena/notifications?limit=${limit}${unreadOnly ? '&unread=1' : ''}`);
export const readParticipantInbox = (eventIds?: string[]) => participantRequest('/api/arena/notifications', { method: 'POST', body: JSON.stringify(eventIds ? { eventIds } : { all: true }) });

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
