'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackMetaEvent } from '@/lib/meta-pixel';

/**
 * Reports a page view to Meta on arrival and on every in-app navigation.
 *
 * Renders nothing. Which pages are skipped, and why, is decided in
 * src/lib/meta-pixel.ts.
 */
export function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    trackMetaEvent('PageView');
  }, [pathname]);

  return null;
}
