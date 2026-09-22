import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";
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
    // Same 429 shape as the CV scanner (src/app/api/cv-scan/route.ts): the
    // envelope's arenaError carries no headers, and a limiter without a
    // Retry-After leaves the client guessing when to come back.
    if (error instanceof ArenaDomainError && error.code === "RATE_LIMITED") {
      const retryAfter = typeof error.details?.retryAfterSeconds === "number" ? error.details.retryAfterSeconds : 60;
      return Response.json(
        { error: { code: "RATE_LIMITED", message: error.message } },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) } },
      );
    }
    return arenaError(error);
  }
}
