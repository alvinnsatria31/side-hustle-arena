import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaForbidden, arenaUnauthorized, enrollmentIdSchema, getArenaWorkspace, patchArenaWorkspace, workspacePatchSchema } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";

export const dynamic = "force-dynamic";

async function getContext(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!enrollmentIdSchema.safeParse(id).success) throw new ArenaDomainError("VALIDATION_ERROR", "Invalid enrollment id.");
  return id;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  try {
    return arenaData(await getArenaWorkspace({ userId: user.id, enrollmentId: await getContext(context) }));
  } catch (error) {
    return arenaError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return arenaError(new ArenaDomainError("VALIDATION_ERROR", "Invalid JSON request body."));
  }
  const parsed = workspacePatchSchema.safeParse(body);
  if (!parsed.success) return arenaError(new ArenaDomainError("VALIDATION_ERROR", "Invalid workspace request."));

  try {
    return arenaData(await patchArenaWorkspace({ userId: user.id, enrollmentId: await getContext(context), input: parsed.data }));
  } catch (error) {
    return arenaError(error);
  }
}
