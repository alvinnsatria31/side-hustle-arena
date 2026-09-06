import { getCurrentUser } from "@/server/auth/session";
import { arenaData, arenaUnauthorized } from "@/server/arena/http";
import { listCvScans } from "@/server/cv/history";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    return arenaData({ scans: await listCvScans(user.id) });
  } catch {
    return Response.json({ error: { message: "Riwayat CV belum dapat dimuat. Coba lagi." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
