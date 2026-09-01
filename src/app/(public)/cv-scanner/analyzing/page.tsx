import { CvAnalyzingView } from '@/components/cv-scanner/CvAnalyzingView';

export const metadata = { title: 'Menganalisis CV' };

export default function CvAnalyzingPage() {
  return <CvAnalyzingView basePath="/cv-scanner" />;
}
