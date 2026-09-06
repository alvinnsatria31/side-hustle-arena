'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface Participant {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** The preset avatar they picked, or null if they have not yet. */
  avatarId: string | null;
}

interface ParticipantValue {
  user: Participant;
  /** Applied locally after a successful save, so the navbar updates in place. */
  setAvatarId: (avatarId: string) => void;
}

const ParticipantContext = createContext<ParticipantValue | null>(null);

export function ParticipantProvider({ user, children }: { user: Participant; children: ReactNode }) {
  // The server-rendered identity is the starting point, not the whole truth:
  // picking an avatar has to show up immediately on every surface that reads
  // this context, and a round trip through the server would blank the page the
  // participant just interacted with.
  const [avatarId, setStoredAvatarId] = useState<string | null>(user.avatarId);
  const setAvatarId = useCallback((next: string) => setStoredAvatarId(next), []);
  const value = useMemo<ParticipantValue>(
    () => ({ user: { ...user, avatarId }, setAvatarId }),
    [user, avatarId, setAvatarId],
  );
  return <ParticipantContext.Provider value={value}>{children}</ParticipantContext.Provider>;
}

function useParticipantValue() {
  const value = useContext(ParticipantContext);
  if (!value) throw new Error('Participant session is missing.');
  return value;
}

export function useParticipant() {
  return useParticipantValue().user;
}

/** The picked avatar plus the local setter the picker calls once its save lands. */
export function useParticipantAvatar() {
  const { user, setAvatarId } = useParticipantValue();
  return { avatarId: user.avatarId, setAvatarId };
}
