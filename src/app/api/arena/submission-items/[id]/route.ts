import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaUnauthorized } from "@/server/arena";
import { arenaForbidden } from "@/server/arena/http";
import { ArenaDomainError } from "@/server/arena/errors";
import { deleteArenaSubmissionItem, getArenaSubmissionDownload } from "@/server/submissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  const enrollmentId = new URL(request.url).searchParams.get("enrollmentId");
  if (!enrollmentId) return arenaError(new ArenaDomainError("VALIDATION_ERROR", "Enrollment id is required."));
  try {
    return arenaData(await getArenaSubmissionDownload({ userId: user.id, enrollmentId, itemId: (await params).id }));
  } catch (error) {
    return arenaError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  const enrollmentId = new URL(request.url).searchParams.get("enrollmentId");
  if (!enrollmentId) return arenaError(new ArenaDomainError("VALIDATION_ERROR", "Enrollment id is required."));
  try {
    await deleteArenaSubmissionItem({ userId: user.id, enrollmentId, itemId: (await params).id });
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return arenaError(error);
  }
}
