import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaUnauthorized, arenaForbidden } from "@/server/arena/http";
import { deleteCvScan, getCvScan } from "@/server/cv/history";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const missing = () => Response.json({ error: { message: "Hasil CV tidak ditemukan." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
const unavailable = () => Response.json({ error: { message: "Riwayat CV belum tersedia. Coba lagi." } }, { status: 503, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return missing();
    const scan = await getCvScan(user.id, id);
    return scan ? arenaData({ scan }) : missing();
  } catch { return unavailable(); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
    const user = await getCurrentUser();
    if (!user) return arenaUnauthorized();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return missing();
    return await deleteCvScan(user.id, id) ? arenaData({ deleted: true }) : missing();
  } catch { return unavailable(); }
}
