import { redirect } from 'next/navigation';
import { TOOLS_URL } from '@/components/layout/nav-links';

export const dynamic = 'force-dynamic';

export default function CvScannerUploadPage() {
  redirect(`${TOOLS_URL}/cv-scanner`);
}
