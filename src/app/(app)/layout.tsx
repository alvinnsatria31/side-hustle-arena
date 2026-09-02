import { ProtectedAppChrome } from "@/components/layout/AppChrome";
import { requireCurrentUser } from "@/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireCurrentUser();
  return <ProtectedAppChrome>{children}</ProtectedAppChrome>;
}
