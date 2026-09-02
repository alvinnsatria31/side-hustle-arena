import { ArenaDomainError, toArenaErrorResponse } from "./errors";

const noStoreHeaders = { "Cache-Control": "no-store" };

export function arenaData(data: unknown, status = 200) {
  return Response.json({ data }, { status, headers: noStoreHeaders });
}

export function arenaError(error: unknown) {
  const response = toArenaErrorResponse(error);
  return Response.json(response.body, { status: response.status, headers: noStoreHeaders });
}

export function arenaUnauthorized() {
  return Response.json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } }, { status: 401, headers: noStoreHeaders });
}

export function arenaForbidden() {
  return arenaError(new ArenaDomainError("FORBIDDEN", "Forbidden."));
}
