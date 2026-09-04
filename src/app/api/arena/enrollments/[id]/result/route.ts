import { getCurrentUser } from "@/server/auth";
import {
  arenaData,
  arenaError,
  arenaUnauthorized,
  enrollmentIdSchema,
} from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";
import { getArenaResult } from "@/server/finalization/result-service";

export const dynamic = "force-dynamic";

/**
 * User-facing result (PRD §33): skor hanya keluar setelah finalisasi.
 * Sebelum itu responsnya `{ sealed: true }` — layar harus menampilkan status,
 * bukan skor.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  try {
    const { id } = await context.params;
    if (!enrollmentIdSchema.safeParse(id).success) {
      throw new ArenaDomainError("VALIDATION_ERROR", "Invalid enrollment id.");
    }
    return arenaData(await getArenaResult({ userId: user.id, enrollmentId: id }));
  } catch (error) {
    return arenaError(error);
  }
}
