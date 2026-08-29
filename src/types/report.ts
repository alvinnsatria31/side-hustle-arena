export interface CareerSkill {
  id: string;
  label: string;
  score: number;
}

export interface WeeklyScorePoint {
  weekLabel: string;
  score: number;
}

export interface ProjectHistoryItem {
  id: string;
  title: string;
  division: string;
  score: number;
  date: string;
}

export interface CareerReport {
  projectsCompleted: number;
  averageScore: number;
  bestSkill: string;
  currentStreakWeeks: number;
  skills: CareerSkill[];
  growth: WeeklyScorePoint[];
  history: ProjectHistoryItem[];
}
