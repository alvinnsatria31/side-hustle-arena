export interface DemoUser {
  name: string;
  displayName: string;
  email: string;
  initials: string;
}

export interface CareerSnapshot {
  cvScore: number | null;
  projectsCompleted: number;
  skillsProven: string[];
  careerPoints: number;
  careerProgress: number; // 0-100
  level: string;
}
