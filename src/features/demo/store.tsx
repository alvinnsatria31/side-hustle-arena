'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import type { ProjectStatus } from '@/types/project';
import type { CareerSnapshot } from '@/types/user';
import { MOCK_CV_SCORE } from '@/data/mock/cv';
import { useOptionalParticipant } from '@/features/arena/participant';
import { STORAGE_KEY, browserStorage, demoReducer, initialDemoState, readStoredState, type DemoAction, type DemoState } from './state';

export { REVIEW_READY_AFTER_MS, UNDER_REVIEW_AFTER_MS } from './state';
export type { DemoAction, DemoState } from './state';

interface DemoContextValue {
  state: DemoState;
  hydrated: boolean;
  dispatch: React.Dispatch<DemoAction>;
  /** Convenience: current project status for the enrolled project. */
  projectStatus: ProjectStatus;
  snapshot: CareerSnapshot;
  login: () => void;
  logout: () => void;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, initialDemoState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredState(browserStorage());
    if (stored) {
      dispatch({ type: 'HYDRATE', state: stored });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full/blocked — demo continues without persistence
    }
  }, [state]);

  const login = useCallback(() => dispatch({ type: 'LOGIN' }), []);
  const logout = useCallback(() => dispatch({ type: 'LOGOUT' }), []);
  const resetDemo = useCallback(() => dispatch({ type: 'RESET_DEMO' }), []);

  const projectStatus: ProjectStatus = state.enrollment ? state.enrollment.status : 'none';

  const snapshot: CareerSnapshot = useMemo(
    () => ({
      // The real analysis carries its own score; MOCK_CV_SCORE is only the
      // stand-in for a demo session that never ran one.
      cvScore: state.cvScan.status === 'completed' ? (state.cvScan.result?.score ?? MOCK_CV_SCORE) : null,
      projectsCompleted: state.completedHistory.length,
      skillsProven: state.skillsProven,
      careerPoints: state.careerPoints,
      careerProgress: 72,
      level: state.careerPoints >= 400 ? 'Level 3 · Explorer' : 'Level 2 · Starter',
    }),
    [state.cvScan.status, state.cvScan.result, state.completedHistory.length, state.skillsProven, state.careerPoints],
  );

  const value = useMemo(
    () => ({ state, hydrated, dispatch, projectStatus, snapshot, login, logout, resetDemo }),
    [state, hydrated, projectStatus, snapshot, login, logout, resetDemo],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
}

/**
 * Who a CV analysis in this browser belongs to — the signed-in participant on
 * app pages, null for a guest — and a guard that drops a stored copy made
 * under anyone else. Every CV screen calls it, so switching accounts on a
 * shared browser never surfaces the previous person's analysis.
 */
export function useCvOwnerGuard(): string | null {
  const ownerId = useOptionalParticipant()?.id ?? null;
  const { hydrated, dispatch } = useDemo();
  useEffect(() => {
    if (hydrated) dispatch({ type: 'CV_ENFORCE_OWNER', ownerId });
  }, [hydrated, ownerId, dispatch]);
  return ownerId;
}

/** Advances the simulated review pipeline while any app screen is open. */
export function useDemoReviewTicker() {
  const { state, dispatch } = useDemo();
  const status = state.enrollment?.status;
  useEffect(() => {
    if (status !== 'submitted' && status !== 'under_review') return;
    dispatch({ type: 'REVIEW_TICK' });
    const id = window.setInterval(() => dispatch({ type: 'REVIEW_TICK' }), 2_000);
    return () => window.clearInterval(id);
  }, [status, dispatch]);
}
