export const MAX_EMAIL_ATTEMPTS = 6;
export const EMAIL_LEASE_MS = 60_000;

export function retryAt(attempt: number, now: Date) {
  return new Date(now.getTime() + Math.min(5 * 3 ** Math.max(0, attempt - 1), 240) * 60_000);
}

export function retryExpired(firstAttempt: Date | null, now: Date) {
  // Resend retains idempotency keys for 24h. Leave a margin for clock/network delay.
  return firstAttempt !== null && now.getTime() - firstAttempt.getTime() >= 23 * 3600_000;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function emailContent(event: { body: string; actionUrl: string | null }, origin?: string) {
  let destination: string | undefined;
  if (origin && event.actionUrl?.startsWith("/") && !event.actionUrl.startsWith("//") && !event.actionUrl.includes("\\")) {
    try {
      const base = new URL(origin);
      const url = new URL(event.actionUrl, base);
      if (url.protocol === "https:" && url.origin === base.origin) destination = url.href;
    } catch { /* A missing/invalid public origin must not produce an unsafe link. */ }
  }
  return {
    html: `<p>${escapeHtml(event.body)}</p>${destination ? `<p><a href="${escapeHtml(destination)}">Buka Arena</a></p>` : ""}`,
    text: event.body + (destination ? `\n\n${destination}` : ""),
  };
}
