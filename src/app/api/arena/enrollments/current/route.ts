import { getCurrentUser } from "@/server/auth";
import { z } from "zod";
import { ArenaDomainError } from "@/server/arena/errors";
import { arenaData, arenaError, arenaUnauthorized, getCurrentArenaEnrollment } from "@/server/arena";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();

  try {
    const projectId = new URL(request.url).searchParams.get('projectId') ?? undefined;
    if (projectId && !z.string().uuid().safeParse(projectId).success) throw new ArenaDomainError('VALIDATION_ERROR', 'Invalid project ID.');
    return arenaData(await getCurrentArenaEnrollment({ userId: user.id, projectId }));
  } catch (error) {
    return arenaError(error);
  }
}
