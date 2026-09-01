import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { CvUploadView } from '@/components/cv-scanner/CvUploadView';

export const metadata = { title: 'CV Scanner' };

export default function AppCvScannerPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'App', href: '/app' }, { label: 'CV Scanner' }]} />
      <div className="mt-4">
        <CvUploadView basePath="/app/cv-scanner" />
      </div>
    </div>
  );
}
