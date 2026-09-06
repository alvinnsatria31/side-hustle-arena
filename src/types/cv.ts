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

export interface CvResult {
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
