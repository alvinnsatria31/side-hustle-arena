import type { CvResult, CvScanStatus } from '@/types/cv';
import type { PlanDraft, ProjectEnrollment, Submission, WorkspaceStep } from '@/types/project';
import type { DemoUser } from '@/types/user';
import type { HistoryEntry } from '@/types/report';
import { DEMO_USER } from '@/data/mock/user';
import { RECOMMENDED_PROJECT_SLUG, getProject } from '@/data/mock/projects';
import { buildReviewResult } from '@/data/mock/review';

export const STORAGE_KEY = 'sk-demo-state-v1';
export const STATE_VERSION = 1;

/**
 * How long a CV analysis may stay in this browser. The account history is the
 * durable copy; this one only bridges the result page, and a shared computer
 * must not keep it for the next person indefinitely.
 */
export const CV_RESULT_TTL_MS = 24 * 60 * 60 * 1000;

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
    /**
     * The participant the scan was started under; null for a guest. Only that
     * same identity is shown the copy again from this browser.
     */
    ownerId: string | null;
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

export function emptyCvScan(): DemoState['cvScan'] {
  return { status: 'idle', fileName: null, fileSize: null, startedAt: null, completedAt: null, result: null, error: null, ownerId: null };
}

export function initialDemoState(): DemoState {
  return {
    version: STATE_VERSION,
    user: null,
    cvScan: emptyCvScan(),
    recommendedProjectSlug: RECOMMENDED_PROJECT_SLUG,
    enrollment: null,
    completedHistory: SEED_HISTORY,
    skillsProven: SEED_SKILLS,
    careerPoints: SEED_POINTS,
  };
}

function cvScanExpired(cvScan: DemoState['cvScan'], now: number): boolean {
  const stamp = cvScan.completedAt ?? cvScan.startedAt;
  if (!stamp) return Boolean(cvScan.result);
  const at = Date.parse(stamp);
  return Number.isNaN(at) || now - at > CV_RESULT_TTL_MS;
}

export type DemoAction =
  | { type: 'HYDRATE'; state: DemoState }
  | { type: 'LOGIN'; user?: DemoUser }
  | { type: 'LOGOUT' }
  | { type: 'CV_SET_FILE'; fileName: string; fileSize: number; ownerId: string | null }
  | { type: 'CV_CLEAR_FILE' }
  | { type: 'CV_START'; ownerId: string | null }
  | { type: 'CV_COMPLETE'; result: CvResult }
  | { type: 'CV_FAIL'; message: string }
  | { type: 'CV_RESET' }
  /** Drop a CV copy made under another identity, or past its lifetime. */
  | { type: 'CV_ENFORCE_OWNER'; ownerId: string | null }
  | { type: 'ENROLL'; projectSlug: string }
  | { type: 'WS_SET_STEP'; step: WorkspaceStep }
  | { type: 'WS_SAVE_PLAN'; plan: PlanDraft }
  | { type: 'WS_SAVE_NOTES'; notes: string }
  | { type: 'WS_TOGGLE_CHECK'; id: string; value: boolean }
  | { type: 'WS_SUBMIT'; submission: Submission }
  | { type: 'REVIEW_TICK' }
  | { type: 'COMPLETE_PROJECT' }
  | { type: 'RESET_DEMO' };

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'LOGIN':
      return { ...state, user: action.user ?? DEMO_USER };

    case 'LOGOUT':
      // The CV analysis belongs to whoever just left; the next person on this
      // browser must not find it.
      return { ...state, user: null, cvScan: emptyCvScan() };

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
          ownerId: action.ownerId,
        },
      };

    case 'CV_CLEAR_FILE':
    case 'CV_RESET':
      return { ...state, cvScan: emptyCvScan() };

    case 'CV_START':
      return {
        ...state,
        cvScan: { ...state.cvScan, status: 'analyzing', startedAt: new Date().toISOString(), result: null, error: null, ownerId: action.ownerId },
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

    case 'CV_ENFORCE_OWNER': {
      const scan = state.cvScan;
      if (scan.status === 'idle' && !scan.result && !scan.fileName) return state;
      if (scan.ownerId === action.ownerId && !cvScanExpired(scan, Date.now())) return state;
      return { ...state, cvScan: emptyCvScan() };
    }

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
      return initialDemoState();

    default:
      return state;
  }
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Some browsers throw on merely touching `localStorage` when site data is blocked. */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Load persisted state. A CV copy saved before ownership was recorded, or past
 * its lifetime, can be shown to nobody — so it is erased from disk, not just
 * skipped, and so is a blob this version cannot read.
 */
export function readStoredState(storage: StorageLike | null, now = Date.now()): DemoState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoState> | null;
    if (!parsed || parsed.version !== STATE_VERSION || !parsed.cvScan) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    const state = parsed as DemoState;
    if (state.cvScan.ownerId === undefined || cvScanExpired(state.cvScan, now)) {
      const cleaned: DemoState = { ...state, cvScan: emptyCvScan() };
      storage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      return cleaned;
    }
    return state;
  } catch {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // storage blocked — nothing persisted to clean
    }
    return null;
  }
}

/**
 * Forget what this browser kept about the signed-in person. Called as logout
 * or account deletion begins: logout is a full-page POST that leaves the Arena
 * origin, so nothing can run after it.
 */
export function clearLocalAccountData(storage: Pick<Storage, 'removeItem'> | null = browserStorage()) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked — nothing persisted to clear
  }
}
