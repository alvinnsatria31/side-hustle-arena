import { CvResultView } from '@/components/cv-scanner/CvResultView';

export const metadata = { title: 'Hasil CV Scanner' };

export default function AppCvResultPage() {
  return <CvResultView basePath="/app/cv-scanner" hrefPrefix="/app/arena/projects" />;
}
