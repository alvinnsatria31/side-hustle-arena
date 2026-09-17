import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { listAllOrders } from "@/server/store/checkout-service";
import { storeOrderQuerySchema } from "@/server/store/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "store");
    const parsed = storeOrderQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ orders: await listAllOrders(parsed.data) });
  } catch (error) {
    return arenaError(error);
  }
}
