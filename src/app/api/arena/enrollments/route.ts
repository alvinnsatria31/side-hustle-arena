import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaForbidden, arenaUnauthorized, projectSelectionSchema, selectArenaProject } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return arenaError(new ArenaDomainError("VALIDATION_ERROR", "Invalid JSON request body."));
  }
  const parsed = projectSelectionSchema.safeParse(body);
  if (!parsed.success) return arenaError(new ArenaDomainError("VALIDATION_ERROR", "Invalid project selection request."));

  try {
    const result = await selectArenaProject({ userId: user.id, projectId: parsed.data.projectId });
    return arenaData(result, result.created ? 201 : 200);
  } catch (error) {
    return arenaError(error);
  }
}
