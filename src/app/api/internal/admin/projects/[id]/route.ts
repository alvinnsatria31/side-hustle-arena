import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { previewProject } from "@/server/generation/service";

export const dynamic = "force-dynamic";

/** The stored package plus its validation provenance — the editor's starting point. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireArenaAdmin(request, "projects");
    const { id } = await context.params;
    return arenaData(await previewProject({ projectId: id }));
  } catch (error) { return arenaError(error); }
}
