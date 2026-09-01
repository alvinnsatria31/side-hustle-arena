'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useDemo, useDemoReviewTicker } from '@/features/demo/store';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sk-bg" aria-busy="true" aria-label="Memuat aplikasi">
      <span className="h-8 w-8 rounded-full border-[3px] border-sk-blue-tint border-t-sk-blue anim-spin" />
    </div>
  );
}

function AppChrome({ children }: { children: React.ReactNode }) {
  const { hydrated, resetDemo } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useDemoReviewTicker();

  // Demo-safe reset hook: /app?reset=1 (also exposed via the avatar menu).
  useEffect(() => {
    if (!hydrated) return;
    if (searchParams.get('reset') === '1') {
      resetDemo();
      router.replace('/app');
    }
  }, [hydrated, searchParams, resetDemo, router]);

  if (!hydrated) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen flex-col bg-sk-bg">
      <AppNavbar />
      <main key={pathname} className="anim-fade-in mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-16 md:pt-8">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // useSearchParams inside AppChrome requires a Suspense boundary during prerender.
    <Suspense fallback={<LoadingScreen />}>
      <AppChrome>{children}</AppChrome>
    </Suspense>
  );
}
