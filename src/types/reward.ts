export type RewardCategory = 'review' | 'workshop' | 'consultation' | 'template';

export interface Reward {
  id: string;
  title: string;
  description: string;
  category: RewardCategory;
  costPoints: number;
  estimatedTime: string;
  available: boolean;
}
