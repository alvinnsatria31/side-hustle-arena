import "server-only";
import { getAuthConfig } from "./config";

export function hasAllowedMutationOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && getAuthConfig().allowedOrigins.includes(origin);
}
