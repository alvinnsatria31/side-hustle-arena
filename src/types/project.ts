export type ProjectCategory =
  | 'Data Analyst'
  | 'Web Developer'
  | 'Front-End'
  | 'UI/UX'
  | 'Marketing'
  | 'Content'
  | 'Talent Acquisition'
  | 'L&D'
  | 'Administration'
  | 'Partnership';

export type ProjectDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

/** Top-level filter groups shown as chips on the browse page */
export type ProjectGroup = 'Data' | 'Development' | 'Design' | 'Marketing' | 'HR' | 'Business';

export interface ProjectDeliverable {
  id: string;
  title: string;
  description?: string;
}

export interface ProjectResource {
  id: string;
  title: string;
  kind: 'document' | 'dataset' | 'template' | 'link';
  /**
   * Where the participant actually gets the material.
   *
   * Optional only because the mock catalogue predates it. A live resource
   * without a URL is a title with nothing behind it, which is exactly the state
   * the resource list was stuck in, so the renderer treats a missing URL as
   * "not linkable" rather than rendering a dead anchor.
   */
  url?: string;
}

export interface RubricCriterion {
  id: string;
  label: string;
  weight: number; // out of 100
  description: string;
}

export interface ArenaProject {
  slug: string;
  /** Division/display category. Widened from the mock union: live values come from the database. */
  category: string;
  /** Filter group. Widened from the mock union: live values come from divisions. */
  group: string;
  week: number;
  title: string;
  shortDescription: string;
  caseBackground: string;
  role: string;
  mission: string;
  objective: string[];
  deliverables: ProjectDeliverable[];
  skills: string[];
  resources: ProjectResource[];
  difficulty: ProjectDifficulty;
  estimatedTime: string;
  deadlineLabel: string;
  /** Legacy mock field: per-project points are NOT a production rule (PRD §35 ranks pay points, not projects). Absent on live data. */
  points?: number;
  /** Legacy mock field: no live participant counter exists. Absent on live data. */
  participants?: number;
  rubric: RubricCriterion[];
  isThisWeek?: boolean;
}

export type WorkspaceStep = 'brief' | 'plan' | 'work' | 'review' | 'submit';

export type ProjectStatus =
  | 'none'
  | 'active'
  | 'submitted'
  | 'under_review'
  | 'review_ready'
  | 'completed';

export interface PlanTask {
  id: string;
  label: string;
  done: boolean;
}

export interface PlanDraft {
  approach: string;
  tools: string;
  tasks: PlanTask[];
}

export interface ChecklistState {
  [itemId: string]: boolean;
}

export interface Submission {
  url: string;
  explanation: string;
  notes: string;
  submittedAt: string;
}

export interface RubricScore {
  label: string;
  score: number; // out of 25
  max: number;
}

export interface ReviewResult {
  score: number;
  statusLabel: string;
  summary: string;
  rubric: RubricScore[];
  strengths: string[];
  improvements: string[];
  skillsProven: string[];
  pointsEarned: number;
  reviewedAt: string;
}

export interface ProjectEnrollment {
  projectSlug: string;
  status: ProjectStatus;
  workspaceStep: WorkspaceStep;
  plan: PlanDraft;
  notes: string;
  checklist: ChecklistState;
  submission: Submission | null;
  review: ReviewResult | null;
  enrolledAt: string;
}
