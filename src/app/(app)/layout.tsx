import { ProtectedAppChrome } from "@/components/layout/AppChrome";
import { AvatarPickerModal } from "@/components/arena/AvatarPickerModal";
import { requireCurrentUser } from "@/server/auth";
import { arenaAdminScopesFor } from "@/server/admin/auth";
import { ParticipantProvider } from "@/features/arena/participant";

/**
 * Every signed-in surface.
 *
 * A participant arriving from the main site is already authenticated — the
 * session is shared across the domain — so there is no sign-in step here. The
 * only thing the Arena still needs from them is the avatar the leaderboard
 * shows, and the picker asks for it once, on top of whatever page they landed
 * on.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();
  // Only the flag crosses to the client. The scopes themselves stay here, and
  // `(app)/app/admin/layout.tsx` re-derives them for the pages that matter.
  const isAdmin = arenaAdminScopesFor(user.authSubject).length > 0;
  return (
    <ParticipantProvider user={{ ...user, isAdmin }}>
      <ProtectedAppChrome>{children}</ProtectedAppChrome>
      <AvatarPickerModal />
    </ParticipantProvider>
  );
}
