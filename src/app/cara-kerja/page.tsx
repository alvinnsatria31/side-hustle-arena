import type { Metadata } from 'next';
import { ArenaDashboardMockup } from '@/components/arena/mockup/ArenaDashboardMockup';

export const metadata: Metadata = {
  title: 'Cara Kerja Side Hustle Arena — Simulasi 1:1 Dashboard Peserta',
  description: 'Pelajari alur cara kerja Side Hustle Arena melalui simulasi 1:1 dashboard peserta: dari memilih brief proyek mingguan, pengerjaan, deadline, tangga hadiah hingga portofolio.',
};

export default function CaraKerjaPage() {
  return <ArenaDashboardMockup />;
}
