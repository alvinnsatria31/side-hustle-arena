import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena";
import { finalizeArenaUpload } from "@/server/submissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; intentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    const route = await params;
    return arenaData(await finalizeArenaUpload({ userId: user.id, enrollmentId: route.id, intentId: route.intentId }));
  } catch (error) {
    return arenaError(error);
  }
}
