'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/primitives/Button';

/**
 * The canvas every console page sits on.
 *
 * Navigation lives in `AdminSidebar`, so this is only the page's own header
 * and body. It is wider than a participant page because these are tables —
 * the constraint that keeps prose readable makes a ten-column table scroll.
 */
export function AdminShell({ title, children, action, description }: { title: string; children: ReactNode; action?: ReactNode; description?: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-sk-navy">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-sk-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function AdminRefreshButton({ refresh, loading }: { refresh: () => void; loading: boolean }) {
  return (
    <Button variant="ghost" size="sm" disabled={loading} onClick={refresh} iconLeft={<RefreshCw size={15} aria-hidden />}>
      Perbarui
    </Button>
  );
}

/** Server Components (e.g. the overview page) have no client refresh loop of their own. */
export function AdminServerRefreshButton() {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={() => router.refresh()} iconLeft={<RefreshCw size={15} aria-hidden />}>
      Perbarui
    </Button>
  );
}
