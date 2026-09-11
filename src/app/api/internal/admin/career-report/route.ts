import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { careerReportListQuery, listAdminCareerReports } from "@/server/admin/career-report";

export const dynamic = "force-dynamic";

/** Participants with their Career Report summary. Gated on `users`: it lists emails and CV status. */
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "users");
    const query = careerReportListQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ participants: await listAdminCareerReports(query.data) });
  } catch (error) { return arenaError(error); }
}
