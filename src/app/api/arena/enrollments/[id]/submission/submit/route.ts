import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena";
import { submitArenaSubmission } from "@/server/submissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    return arenaData(await submitArenaSubmission({ userId: user.id, enrollmentId: (await params).id }), 201);
  } catch (error) {
    return arenaError(error);
  }
}
