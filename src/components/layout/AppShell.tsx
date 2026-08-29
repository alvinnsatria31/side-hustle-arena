'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { useDemoAuth } from '@/features/auth/useDemoAuth';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthed, hydrated } = useDemoAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isAuthed) {
      router.replace('/login');
    }
  }, [hydrated, isAuthed, router]);

  if (!hydrated || !isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-base)]">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--color-brand-200)] border-t-[var(--color-brand-500)] anim-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[var(--color-surface-base)]">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 pb-24 lg:pb-12">{children}</main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
