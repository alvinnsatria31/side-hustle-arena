import { StateBox } from '@/components/primitives/StateBox';

/**
 * Shown on every CV Scanner route while NEXT_PUBLIC_CV_SCANNER_ENABLED is off.
 *
 * A closed feature should say so. The alternative — leaving the upload form
 * reachable by URL while the endpoint refuses — looks like a broken product
 * rather than one that has not opened yet.
 */
export function CvScannerClosed() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sk-bg px-6 pb-24 pt-24">
      <StateBox
        tone="empty"
        title="CV Scanner belum dibuka."
        description="Fitur ini sedang disiapkan. Sementara itu, kamu sudah bisa mengerjakan project mingguan di Side Hustle Arena dan mengumpulkan bukti skill dari sana."
        primaryAction={{ label: 'Masuk Side Hustle Arena', href: '/arena' }}
      />
    </div>
  );
}
