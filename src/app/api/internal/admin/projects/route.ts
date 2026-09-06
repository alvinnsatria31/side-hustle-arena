import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { listAdminProjects, projectListQuery } from "@/server/admin/content";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "projects");
    const query = projectListQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ projects: await listAdminProjects(query.data) });
  } catch (error) { return arenaError(error); }
}
