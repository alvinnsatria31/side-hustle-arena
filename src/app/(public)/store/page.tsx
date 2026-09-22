import { redirect } from 'next/navigation';
import { TOOLS_URL } from '@/components/layout/nav-links';

export const dynamic = 'force-dynamic';

export default function StorePage() {
  redirect(`${TOOLS_URL}/store`);
}
