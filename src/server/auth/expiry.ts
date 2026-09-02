export const MAX_ARENA_SESSION_MS = 14 * 24 * 60 * 60 * 1_000;

export function getArenaSessionExpiry(grantExpiry: Date, now = new Date()): Date {
  return new Date(Math.min(grantExpiry.getTime(), now.getTime() + MAX_ARENA_SESSION_MS));
}
