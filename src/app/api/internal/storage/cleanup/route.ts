import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";
import { requireAutomationWorker } from "@/server/reviews/internal-auth";
import { cleanupExpiredUploads } from "@/server/storage/cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const cleanupSchema = z.object({
  dryRun: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(25),
}).strict();

export async function POST(request: Request) {
  try {
    requireAutomationWorker(request);
    const input = cleanupSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new ArenaDomainError("VALIDATION_ERROR", "Invalid storage cleanup request.");
    return arenaData(await cleanupExpiredUploads(input.data));
  } catch (error) {
    return arenaError(error);
  }
}
