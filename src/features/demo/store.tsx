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
import type { CvResult, CvScanStatus } from '@/types/cv';
import type {
  PlanDraft,
  ProjectEnrollment,
  ProjectStatus,
  Submission,
  WorkspaceStep,
} from '@/types/project';
import type { DemoUser, CareerSnapshot } from '@/types/user';
import type { HistoryEntry } from '@/types/report';
import { DEMO_USER } from '@/data/mock/user';
import { MOCK_CV_SCORE } from '@/data/mock/cv';
import { RECOMMENDED_PROJECT_SLUG } from '@/data/mock/projects';
import { buildReviewResult } from '@/data/mock/review';
import { getProject } from '@/data/mock/projects';

const STORAGE_KEY = 'sk-demo-state-v1';
const STATE_VERSION = 1;

/** Demo review progresses without a backend: submitted → under_review → review_ready. */
export const UNDER_REVIEW_AFTER_MS = 6_000;
export const REVIEW_READY_AFTER_MS = 20_000;

export interface DemoState {
  version: number;
  user: DemoUser | null;
  cvScan: {
    status: CvScanStatus;
    fileName: string | null;
    fileSize: number | null;
    startedAt: string | null;
    completedAt: string | null;
    /** The analysis returned by /api/cv-scan. Null until a scan succeeds. */
    result: CvResult | null;
    /** Why the last scan failed, shown on the result page. */
    error: string | null;
  };
  recommendedProjectSlug: string;
  enrollment: ProjectEnrollment | null;
  completedHistory: HistoryEntry[];
  skillsProven: string[];
  careerPoints: number;
}

const SEED_HISTORY: HistoryEntry[] = [
  {
    projectSlug: 'landing-page-coffee-umkm',
    title: 'Landing Page untuk Coffee UMKM',
    category: 'Front-End',
    skills: ['HTML', 'CSS', 'Responsive'],
    score: 84,
    completedAt: '2026-08-26T21:00:00.000Z',
  },
  {
    projectSlug: 'content-plan-4-minggu',
    title: 'Content Plan 4 Minggu',
    category: 'Content',
    skills: ['Content Strategy', 'Copywriting'],
    score: 80,
    completedAt: '2026-08-19T21:00:00.000Z',
  },
];

const SEED_SKILLS = ['HTML', 'CSS', 'Responsive', 'Content Strategy', 'Copywriting', 'Communication'];
const SEED_POINTS = 320;

function initialState(): DemoState {
  return {
    version: STATE_VERSION,
    user: null,
    cvScan: {
      status: 'idle',
      fileName: null,
      fileSize: null,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    },
    recommendedProjectSlug: RECOMMENDED_PROJECT_SLUG,
    enrollment: null,
    completedHistory: SEED_HISTORY,
    skillsProven: SEED_SKILLS,
    careerPoints: SEED_POINTS,
  };
}

export type DemoAction =
  | { type: 'HYDRATE'; state: DemoState }
  | { type: 'LOGIN'; user?: DemoUser }
  | { type: 'LOGOUT' }
  | { type: 'CV_SET_FILE'; fileName: string; fileSize: number }
  | { type: 'CV_CLEAR_FILE' }
  | { type: 'CV_START' }
  | { type: 'CV_COMPLETE'; result: CvResult }
  | { type: 'CV_FAIL'; message: string }
  | { type: 'CV_RESET' }
  | { type: 'ENROLL'; projectSlug: string }
  | { type: 'WS_SET_STEP'; step: WorkspaceStep }
  | { type: 'WS_SAVE_PLAN'; plan: PlanDraft }
  | { type: 'WS_SAVE_NOTES'; notes: string }
  | { type: 'WS_TOGGLE_CHECK'; id: string; value: boolean }
  | { type: 'WS_SUBMIT'; submission: Submission }
  | { type: 'REVIEW_TICK' }
  | { type: 'COMPLETE_PROJECT' }
  | { type: 'RESET_DEMO' };

function reducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'LOGIN':
      return { ...state, user: action.user ?? DEMO_USER };

    case 'LOGOUT':
      return { ...state, user: null };

    case 'CV_SET_FILE':
      return {
        ...state,
        cvScan: {
          status: 'file_selected',
          fileName: action.fileName,
          fileSize: action.fileSize,
          startedAt: null,
          completedAt: null,
          result: null,
          error: null,
        },
      };

    case 'CV_CLEAR_FILE':
    case 'CV_RESET':
      return {
        ...state,
        cvScan: { status: 'idle', fileName: null, fileSize: null, startedAt: null, completedAt: null, result: null, error: null },
      };

    case 'CV_START':
      return {
        ...state,
        cvScan: { ...state.cvScan, status: 'analyzing', startedAt: new Date().toISOString(), result: null, error: null },
      };

    case 'CV_COMPLETE':
      return {
        ...state,
        cvScan: {
          ...state.cvScan,
          status: 'completed',
          completedAt: new Date().toISOString(),
          result: action.result,
          fileName: action.result.fileName,
          error: null,
        },
      };

    case 'CV_FAIL':
      return { ...state, cvScan: { ...state.cvScan, status: 'failed', result: null, error: action.message } };

    case 'ENROLL': {
      // Starting a new project replaces a finished enrollment (history already recorded).
      const fresh: ProjectEnrollment = {
        projectSlug: action.projectSlug,
        status: 'active',
        workspaceStep: 'brief',
        plan: { approach: '', tools: '', tasks: [] },
        notes: '',
        checklist: {},
        submission: null,
        review: null,
        enrolledAt: new Date().toISOString(),
      };
      return { ...state, user: state.user ?? DEMO_USER, enrollment: fresh };
    }

    case 'WS_SET_STEP':
      if (!state.enrollment) return state;
      return {
        ...state,
        enrollment: { ...state.enrollment, workspaceStep: action.step },
      };

    case 'WS_SAVE_PLAN':
      if (!state.enrollment) return state;
      return { ...state, enrollment: { ...state.enrollment, plan: action.plan } };

    case 'WS_SAVE_NOTES':
      if (!state.enrollment) return state;
      return { ...state, enrollment: { ...state.enrollment, notes: action.notes } };

    case 'WS_TOGGLE_CHECK':
      if (!state.enrollment) return state;
      return {
        ...state,
        enrollment: {
          ...state.enrollment,
          checklist: { ...state.enrollment.checklist, [action.id]: action.value },
        },
      };

    case 'WS_SUBMIT':
      if (!state.enrollment) return state;
      return {
        ...state,
        enrollment: {
          ...state.enrollment,
          status: 'submitted',
          submission: action.submission,
        },
      };

    case 'REVIEW_TICK': {
      const enrollment = state.enrollment;
      if (!enrollment || !enrollment.submission) return state;
      const elapsed = Date.now() - new Date(enrollment.submission.submittedAt).getTime();
      const project = getProject(enrollment.projectSlug);
      if (!project) return state;

      if (elapsed >= REVIEW_READY_AFTER_MS && enrollment.status !== 'review_ready' && enrollment.status !== 'completed') {
        return {
          ...state,
          enrollment: {
            ...enrollment,
            status: 'review_ready',
            review: buildReviewResult(project, new Date(enrollment.submission.submittedAt)),
          },
        };
      }
      if (elapsed >= UNDER_REVIEW_AFTER_MS && enrollment.status === 'submitted') {
        return { ...state, enrollment: { ...enrollment, status: 'under_review' } };
      }
      return state;
    }

    case 'COMPLETE_PROJECT': {
      const enrollment = state.enrollment;
      if (!enrollment || !enrollment.review || enrollment.status === 'completed') return state;
      const project = getProject(enrollment.projectSlug);
      if (!project) return state;
      const entry: HistoryEntry = {
        projectSlug: project.slug,
        title: project.title,
        category: project.category,
        skills: enrollment.review.skillsProven,
        score: enrollment.review.score,
        completedAt: enrollment.review.reviewedAt,
      };
      const dedup = state.completedHistory.some((h) => h.projectSlug === project.slug);
      return {
        ...state,
        enrollment: { ...enrollment, status: 'completed' },
        completedHistory: dedup ? state.completedHistory : [...state.completedHistory, entry],
        skillsProven: Array.from(new Set([...state.skillsProven, ...enrollment.review.skillsProven])),
        careerPoints: state.careerPoints + enrollment.review.pointsEarned,
      };
    }

    case 'RESET_DEMO':
      return initialState();

    default:
      return state;
  }
}

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

function loadStoredState(): DemoState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    if (parsed.version !== STATE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadStoredState();
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
      cvScore: state.cvScan.status === 'completed' ? MOCK_CV_SCORE : null,
      projectsCompleted: state.completedHistory.length,
      skillsProven: state.skillsProven,
      careerPoints: state.careerPoints,
      careerProgress: 72,
      level: state.careerPoints >= 400 ? 'Level 3 · Explorer' : 'Level 2 · Starter',
    }),
    [state.cvScan.status, state.completedHistory.length, state.skillsProven, state.careerPoints],
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
