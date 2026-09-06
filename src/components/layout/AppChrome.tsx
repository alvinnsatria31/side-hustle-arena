"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-sk-bg" aria-busy="true" aria-label="Memuat aplikasi"><span className="h-8 w-8 rounded-full border-[3px] border-sk-blue-tint border-t-sk-blue anim-spin" /></div>;
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The admin console brings its own rail and owns the full viewport. Keeping
  // the participant navbar there would stack two navigations that lead to
  // different places, and the bottom tab bar would sit over the tables.
  const console = pathname.startsWith("/app/admin");
  if (console) return <div key={pathname} className="anim-fade-in">{children}</div>;
  return <div className="flex min-h-screen flex-col bg-sk-bg"><AppNavbar /><main key={pathname} className="anim-fade-in mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-16 md:pt-8">{children}</main><MobileBottomNav /></div>;
}

export function ProtectedAppChrome({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}><AppChrome>{children}</AppChrome></Suspense>;
}
