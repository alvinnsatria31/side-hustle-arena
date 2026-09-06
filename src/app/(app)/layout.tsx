import { ProtectedAppChrome } from "@/components/layout/AppChrome";
import { requireCurrentUser } from "@/server/auth";
import { ParticipantProvider } from "@/features/arena/participant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();
  return <ParticipantProvider user={user}><ProtectedAppChrome>{children}</ProtectedAppChrome></ParticipantProvider>;
}
