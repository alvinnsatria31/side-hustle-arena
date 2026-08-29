export type ProjectDivision =
  | 'Marketing'
  | 'Human Resources'
  | 'UI/UX'
  | 'Data'
  | 'Business'
  | 'AI'
  | 'Operations'
  | 'Product'
  | 'Content';

export type ProjectDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface ProjectDeliverable {
  id: string;
  title: string;
  description?: string;
}

export interface ProjectResource {
  id: string;
  title: string;
  kind: 'document' | 'video' | 'dataset' | 'template';
}

export interface WeeklyProject {
  slug: string;
  division: ProjectDivision;
  title: string;
  case: string;
  role: string;
  objective: string;
  difficulty: ProjectDifficulty;
  effort: string;
  skills: string[];
  deliverables: ProjectDeliverable[];
  resources: ProjectResource[];
  rewardPoints: number;
  deadlineLabel: string;
  evaluation?: ProjectEvaluation;
}

export type ProjectStatus =
  | 'available'
  | 'selected'
  | 'in_progress'
  | 'draft'
  | 'submitted'
  | 'evaluating'
  | 'result'
  | 'expired';

export interface RubricScore {
  label: string;
  score: number;
  description: string;
}

export interface ProjectEvaluation {
  score: number;
  statusLabel: string;
  statusTone: 'good' | 'strong' | 'fair' | 'poor';
  rubric: RubricScore[];
  strengths: string[];
  improvements: string[];
  evaluatorNote: string;
  submittedAt: string;
  evaluatedAt: string;
}

export interface ProjectDraft {
  projectSlug: string;
  text: string;
  link: string;
  notes: string;
  deliverables: Record<string, boolean>;
  updatedAt: string;
}

export interface ProjectSubmission {
  projectSlug: string;
  submittedAt: string;
  resultAvailableAt: string;
}
