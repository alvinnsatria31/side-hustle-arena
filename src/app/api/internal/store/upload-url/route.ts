import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { createProductUploadUrl } from "@/server/store/admin-service";
import { storeUploadSchema } from "@/server/store/schemas";

export const dynamic = "force-dynamic";

/** A signed PUT for a product file. The object key is minted server-side, never accepted. */
export async function POST(request: Request) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "store");
    const parsed = storeUploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ upload: await createProductUploadUrl({ mimeType: parsed.data.mimeType, actorSubject }) });
  } catch (error) {
    return arenaError(error);
  }
}
