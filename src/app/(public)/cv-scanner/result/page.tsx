import { CvResultView } from '@/components/cv-scanner/CvResultView';

export const metadata = { title: 'Hasil CV Scanner' };

export default function CvResultPage() {
  return (
    <div className="relative min-h-screen bg-sk-bg">
      <CvResultView basePath="/cv-scanner" />
    </div>
  );
}
