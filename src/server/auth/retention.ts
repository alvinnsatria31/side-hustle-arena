export const ARENA_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export function isArenaSessionEligibleForCleanup(
  session: { expiresAt: Date; revokedAt: Date | null },
  now = new Date(),
): boolean {
  const cutoff = now.getTime() - ARENA_SESSION_RETENTION_MS;
  return session.expiresAt.getTime() < cutoff || (session.revokedAt?.getTime() ?? Infinity) < cutoff;
}
