export type CVMetricKey =
  | 'ats'
  | 'content'
  | 'keywords'
  | 'readability'
  | 'recruiter';

export interface CVMetric {
  key: CVMetricKey;
  label: string;
  score: number;
  description: string;
}

export type CVIssuePriority = 'high' | 'medium' | 'low';

export interface CVIssue {
  id: string;
  rank: number;
  title: string;
  explanation: string;
  suggestion: string;
  priority: CVIssuePriority;
}

export interface CVStrength {
  id: string;
  title: string;
  description?: string;
}

export interface BeforeAfterExample {
  id: string;
  before: string;
  after: string;
  rationale: string;
}

export interface KeywordMatch {
  found: string[];
  missing: string[];
  score: number;
}

export interface Recommendation {
  id: string;
  trigger: string;
  title: string;
  description: string;
  cta: string;
}

export interface CVAnalysis {
  score: number;
  status: 'poor' | 'fair' | 'good' | 'strong';
  statusLabel: string;
  summary: string;
  metrics: CVMetric[];
  priorityIssues: CVIssue[];
  strengths: CVStrength[];
  beforeAfter: BeforeAfterExample;
  keywordMatch?: KeywordMatch;
  recommendations: Recommendation[];
}
