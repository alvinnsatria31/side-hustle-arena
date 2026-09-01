export interface HistoryEntry {
  projectSlug: string;
  title: string;
  category: string;
  skills: string[];
  score: number;
  completedAt: string;
}

export interface SkillLevel {
  name: string;
  score: number; // 0-100
  weak?: boolean;
}

export interface JobMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  matchScore: number;
  skills: string[];
  type: string;
}

export interface CareerReportData {
  progress: number;
  progressTrend: string;
  projectsCompleted: number;
  skillsProvenCount: number;
  averageScore: number;
  previousAverage: number;
  careerPoints: number;
  level: string;
  strongestSkills: SkillLevel[];
  needsImprovement: SkillLevel[];
  history: HistoryEntry[];
  nextProjectSlug: string;
  nextProjectReason: string;
  jobs: {
    matches: number;
    topFit: string;
    matchScore: number;
  };
}
