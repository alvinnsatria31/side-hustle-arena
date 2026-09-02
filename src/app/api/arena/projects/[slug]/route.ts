import { arenaData, arenaError, getVisibleArenaProject, projectSlugSchema } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!projectSlugSchema.safeParse(slug).success) return arenaError(new ArenaDomainError("VALIDATION_ERROR", "Invalid project slug."));

  try {
    return arenaData(await getVisibleArenaProject({ slug }));
  } catch (error) {
    return arenaError(error);
  }
}
