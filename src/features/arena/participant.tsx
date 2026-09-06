'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface Participant {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}
const ParticipantContext = createContext<Participant | null>(null);
export function ParticipantProvider({ user, children }: { user: Participant; children: ReactNode }) {
  return <ParticipantContext.Provider value={user}>{children}</ParticipantContext.Provider>;
}
export function useParticipant() {
  const user = useContext(ParticipantContext);
  if (!user) throw new Error('Participant session is missing.');
  return user;
}
