import { after } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaForbidden, arenaUnauthorized } from "@/server/arena";
import { submitArenaSubmission } from "@/server/submissions";
import { notifyVps } from "@/server/automation/vps-hooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    const enrollmentId = (await params).id;
    const result = await submitArenaSubmission({ userId: user.id, enrollmentId });
    // Best-effort VPS hook (grading/publish workflows): runs after the
    // response is sent, never blocks or fails the submit (PRD §36).
    if (result.version.accessStatus === "ACCESSIBLE") {
      const payload = { enrollment_id: enrollmentId, version_id: result.version.id, attempt: result.version.reviewAttemptNumber };
      after(() => notifyVps("arena-submit", payload));
    }
    return arenaData(result, 201);
  } catch (error) {
    return arenaError(error);
  }
}
