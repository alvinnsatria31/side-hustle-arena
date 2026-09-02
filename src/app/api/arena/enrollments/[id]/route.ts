import { getCurrentUser } from "@/server/auth";
import { arenaData, arenaError, arenaUnauthorized, enrollmentIdSchema, getArenaEnrollment } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  const { id } = await context.params;
  if (!enrollmentIdSchema.safeParse(id).success) return arenaError(new ArenaDomainError("VALIDATION_ERROR", "Invalid enrollment id."));

  try {
    return arenaData(await getArenaEnrollment({ userId: user.id, enrollmentId: id }));
  } catch (error) {
    return arenaError(error);
  }
}
