import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";
import { createArenaUploadIntent } from "@/server/submissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    return arenaData(await createArenaUploadIntent({ userId: user.id, enrollmentId: (await params).id, input: await request.json() }), 201);
  } catch (error) {
    return arenaError(error instanceof SyntaxError ? new ArenaDomainError("VALIDATION_ERROR", "Invalid JSON request body.") : error);
  }
}
