export interface SpotlightProject {
  slug: string;
  week: number;
  weekLabel: string;
  projectTitle: string;
  projectSlug: string;
  participant: string;
  role: string;
  score: number;
  skillsProven: string[];
  reason: string;
  challenge: string;
  process: string[];
  deliverables: string[];
  feedbackExcerpt: string;
  isFeatured?: boolean;
}
