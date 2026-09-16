export type CvScanStatus = 'idle' | 'file_selected' | 'analyzing' | 'completed' | 'failed';

export interface CvMetric {
  key: 'quality' | 'ats' | 'impact' | 'evidence';
  label: string;
  score: number;
  weak?: boolean;
}

export type EvidenceLevel = 'kuat' | 'cukup' | 'kurang' | 'belum';

export interface SkillEvidence {
  skill: string;
  level: EvidenceLevel;
  note: string;
}

export interface CvStrongPoint {
  text: string;
}

/** One pass/fail finding behind a metric. */
export interface CvCheckItem {
  label: string;
  pass: boolean;
  note: string;
}

/** A weak achievement line and the measurable rewrite of it. */
export interface CvImpactExample {
  before: string;
  after: string;
}

/** The position the visitor chose to be scanned against. */
export interface CvResultTarget {
  roleId: string;
  roleLabel: string;
  level?: string;
  company?: string;
}

/** How well the CV fits the chosen position. Present only when one was chosen. */
export interface CvRoleFit {
  score: number;
  /** Server-derived from the score, so the verdict always matches the number. */
  label: string;
  /** The role the CV currently reads as, which may differ from the target. */
  readAs: string;
  summary: string;
  /** What stands between this CV and the chosen position. */
  gaps: string[];
}

export interface CvResult {
  /** Absent when the visitor skipped the question and the role was inferred. */
  target?: CvResultTarget;
  roleFit?: CvRoleFit;
  score: number;
  statusLabel: string;
  metrics: CvMetric[];
  strengths: string[];
  improvements: string[];
  evidence: SkillEvidence[];
  /** Findings behind the CV Quality score. */
  qualityChecks: CvCheckItem[];
  /** Findings behind the ATS Readiness score. */
  atsChecks: CvCheckItem[];
  /** Empty when nothing in the CV needed rewriting. */
  impactExamples: CvImpactExample[];
  fileName: string;
  analyzedAt: string;
}

export interface AnalyzeStep {
  label: string;
}

/** Result tab keys used by /cv-scanner/result */
export type CvResultTab = 'overview' | 'quality' | 'ats' | 'impact' | 'evidence';
