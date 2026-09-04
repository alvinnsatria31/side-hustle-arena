import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ArenaDomainError } from "@/server/arena/errors";

/**
 * Internal automation authentication (PRD §40).
 *
 * Hermes/VPS workers authenticate with a server-only bearer token, never with
 * database credentials and never with user sessions. Scopes are conceptual
 * (claim/complete/fail review jobs, report automation); the token grants only
 * the internal review-worker routes in this phase — no user reads, no admin
 * user management, no arbitrary SQL.
 *
 * Fail-closed: a missing INTERNAL_AUTOMATION_TOKEN denies every call, so a
 * misconfigured environment cannot silently open the worker API.
 */
export function requireAutomationWorker(request: Request): { workerId: string } {
  const expected = process.env.INTERNAL_AUTOMATION_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  const [scheme, presented] = header.split(" ");
  if (!expected || scheme !== "Bearer" || !presented) {
    throw new ArenaDomainError("FORBIDDEN", "Automation authentication is required.");
  }
  const expectedBuffer = Buffer.from(expected);
  const presentedBuffer = Buffer.from(presented);
  if (expectedBuffer.length !== presentedBuffer.length || !timingSafeEqual(expectedBuffer, presentedBuffer)) {
    throw new ArenaDomainError("FORBIDDEN", "Invalid automation credentials.");
  }
  return { workerId: "internal-automation" };
}
