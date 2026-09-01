import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { CvUploadView } from '@/components/cv-scanner/CvUploadView';

export const metadata = { title: 'CV Scanner' };

export default function CvScannerUploadPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-sk-bg">
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-28 md:pt-32">
        <Breadcrumb items={[{ label: 'SekolahKarir', href: '/' }, { label: 'CV Scanner' }]} />
        <div className="mt-2">
          <CvUploadView basePath="/cv-scanner" />
        </div>
      </div>
    </div>
  );
}
