import "server-only";

export function assertOwnsUser(authenticatedUserId: string, ownerUserId: string): void {
  if (authenticatedUserId !== ownerUserId) throw new Error("Forbidden.");
}
