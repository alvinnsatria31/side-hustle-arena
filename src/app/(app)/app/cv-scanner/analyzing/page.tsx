import { CvAnalyzingView } from '@/components/cv-scanner/CvAnalyzingView';

export const metadata = { title: 'Menganalisis CV' };

export default function AppCvAnalyzingPage() {
  return <CvAnalyzingView basePath="/app/cv-scanner" />;
}
