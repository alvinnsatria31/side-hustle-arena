import type { Reward } from '@/types/reward';

export const mockRewards: Reward[] = [
  {
    id: 'rw-1',
    title: 'CV Review Session',
    description: 'Sesi 30 menit dengan reviewer karirmu untuk review CV dan portofolio.',
    category: 'review',
    costPoints: 1500,
    estimatedTime: '30 menit · online',
    available: true,
  },
  {
    id: 'rw-2',
    title: 'Exclusive Workshop',
    description: 'Akses workshop eksklusif bersama praktisi industri.',
    category: 'workshop',
    costPoints: 2000,
    estimatedTime: '2 jam · online',
    available: true,
  },
  {
    id: 'rw-3',
    title: 'Career Consultation',
    description: 'Konsultasi karier 1-on-1 dengan mentor sesuai bidangmu.',
    category: 'consultation',
    costPoints: 3000,
    estimatedTime: '45 menit · online',
    available: false,
  },
  {
    id: 'rw-4',
    title: 'Premium Template Pack',
    description: 'Paket template CV, portofolio, dan case study yang siap pakai.',
    category: 'template',
    costPoints: 800,
    estimatedTime: 'Akses instan',
    available: true,
  },
];
