export function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) return "Selesai";

  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}j ${minutes}m ${seconds}d`;
}
