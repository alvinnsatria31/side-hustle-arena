import "server-only";
import { getArenaMutationOrigins } from "./config";

export function hasAllowedMutationOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && getArenaMutationOrigins().includes(origin);
}
