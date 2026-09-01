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

export interface CvResult {
  score: number;
  statusLabel: string;
  metrics: CvMetric[];
  strengths: string[];
  improvements: string[];
  evidence: SkillEvidence[];
  fileName: string;
  analyzedAt: string;
}

export interface AnalyzeStep {
  label: string;
}

/** Result tab keys used by /cv-scanner/result */
export type CvResultTab = 'overview' | 'quality' | 'ats' | 'impact' | 'evidence';
