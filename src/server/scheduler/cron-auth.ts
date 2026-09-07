import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ArenaDomainError } from "@/server/arena/errors";

/**
 * Scheduled-job authentication.
 *
 * Vercel Cron calls the job URL with `Authorization: Bearer $CRON_SECRET`.
 * `INTERNAL_AUTOMATION_TOKEN` is accepted too so the same jobs can be triggered
 * by the existing Hermes/VPS automation or by hand during an incident, without
 * minting a second class of credential.
 *
 * Fail-closed in the same way as the worker API: with neither secret set every
 * call is denied, so a half-configured environment cannot leave the scheduler
 * open to the internet.
 */
export function requireCronCaller(request: Request): { callerId: string } {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, presented] = header.split(" ");
  if (scheme !== "Bearer" || !presented) {
    throw new ArenaDomainError("FORBIDDEN", "Scheduler authentication is required.");
  }

  const candidates: Array<[string, string | undefined]> = [
    ["vercel-cron", process.env.CRON_SECRET],
    ["internal-automation", process.env.INTERNAL_AUTOMATION_TOKEN],
    ["arena-cron", process.env.ARENA_CRON_TOKEN],
  ];
  for (const [callerId, expected] of candidates) {
    if (!expected) continue;
    const expectedBuffer = Buffer.from(expected);
    const presentedBuffer = Buffer.from(presented);
    if (expectedBuffer.length !== presentedBuffer.length) continue;
    if (timingSafeEqual(expectedBuffer, presentedBuffer)) return { callerId };
  }
  throw new ArenaDomainError("FORBIDDEN", "Invalid scheduler credentials.");
}
