import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena";
import { requireArenaAdmin } from "@/server/admin/auth";
import { setArenaFeatureFlag } from "@/server/admin/overview";

export const dynamic = "force-dynamic";

const flagSchema = z.object({
  key: z.string().trim().min(1).max(64),
  closed: z.boolean(),
  message: z.string().trim().max(500).nullable().optional(),
});

/** Flip a maintenance switch (audited). Unknown keys are rejected. */
export async function POST(request: Request) {
  try {
    const parsed = flagSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ done: false, reason: "VALIDATION_ERROR" }, 400);
    const scope = parsed.data.key === "rewards-redemption" ? "rewards" : "projects";
    const { actorSubject } = await requireArenaAdmin(request, scope);
    return arenaData({ done: await setArenaFeatureFlag({ ...parsed.data, actorSubject }) });
  } catch (error) {
    return arenaError(error);
  }
}
