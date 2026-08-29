import { AppShell } from '@/components/layout/AppShell';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
