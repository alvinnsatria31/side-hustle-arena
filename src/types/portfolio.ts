export type PortfolioStatus = 'draft' | 'published';

export interface PortfolioProject {
  id: string;
  title: string;
  role: string;
  division: string;
  period: string;
  skills: string[];
  score: number;
  status: PortfolioStatus;
  summary: string;
  challenge: string;
  approach: string;
  result: string;
  deliverables: string[];
  evaluatorQuote?: string;
  featured?: boolean;
}
