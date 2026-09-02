import { arenaData, arenaError, divisionSlugSchema, listVisibleArenaProjects } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const division = new URL(request.url).searchParams.get("division");
  if (division !== null && !divisionSlugSchema.safeParse(division).success) {
    return arenaError(new ArenaDomainError("VALIDATION_ERROR", "Invalid division filter."));
  }

  try {
    return arenaData(await listVisibleArenaProjects({ divisionSlug: division ?? undefined }));
  } catch (error) {
    return arenaError(error);
  }
}
