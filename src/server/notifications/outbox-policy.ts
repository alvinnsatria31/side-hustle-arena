export const MAX_EMAIL_ATTEMPTS = 6;
export const EMAIL_LEASE_MS = 60_000;
/**
 * How long a message may keep being retried.
 *
 * Resend retains idempotency keys for 24h; past that, reusing the key on a
 * send that may secretly have succeeded could deliver twice. So a message that
 * outlives the window is held for an operator rather than retried. That is the
 * right call — and it makes the flush cadence a correctness requirement, not a
 * tuning preference. See `flushCadenceIsSafe`.
 */
export const EMAIL_RETRY_WINDOW_MS = 23 * 3600_000;

export function retryAt(attempt: number, now: Date) {
  return new Date(now.getTime() + retryDelayMs(attempt));
}

/** Backoff ladder: 5m, 15m, 45m, 135m, then 240m for every later attempt. */
export function retryDelayMs(attempt: number) {
  return Math.min(5 * 3 ** Math.max(0, attempt - 1), 240) * 60_000;
}

/** Wall-clock time the full ladder needs to exhaust MAX_EMAIL_ATTEMPTS. */
export function retryLadderSpanMs() {
  let total = 0;
  for (let attempt = 1; attempt < MAX_EMAIL_ATTEMPTS; attempt += 1) total += retryDelayMs(attempt);
  return total;
}

/**
 * Is a flush schedule fast enough to be honest about its retry budget?
 *
 * A retry only happens on a tick, so the real time between attempts is the
 * backoff plus up to one flush interval. With a daily flush the second attempt
 * landed 24h after the first — already outside the window — so every failed
 * message was held having used exactly one of its six attempts. Six attempts
 * that can never be taken are not a retry policy.
 */
export function flushCadenceIsSafe(intervalMs: number) {
  return retryLadderSpanMs() + intervalMs * MAX_EMAIL_ATTEMPTS < EMAIL_RETRY_WINDOW_MS;
}

export function retryExpired(firstAttempt: Date | null, now: Date) {
  return firstAttempt !== null && now.getTime() - firstAttempt.getTime() >= EMAIL_RETRY_WINDOW_MS;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/**
 * Hosts an email may link to besides the Arena itself.
 *
 * A notification's actionUrl becomes a clickable link in mail signed with our
 * domain, so an arbitrary absolute URL is still never linked. Digital rewards
 * are handed over as a link an admin set, and those links live on a few known
 * hosts. Anything outside this list still reaches the participant — as text
 * they can read before deciding to open it.
 */
export const DEFAULT_EMAIL_LINK_HOSTS = ["notion.site", "notion.so", "sekolahkarir.id"];

export function emailLinkHosts(configured = process.env.ARENA_EMAIL_LINK_HOSTS): string[] {
  const listed = (configured ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return listed.length ? listed : DEFAULT_EMAIL_LINK_HOSTS;
}

function hostAllowed(hostname: string, allowed: string[]) {
  return allowed.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));
}

export function emailContent(
  event: { body: string; actionUrl: string | null },
  origin?: string,
  allowedHosts: string[] = emailLinkHosts(),
) {
  let destination: string | undefined;
  let external = false;
  const actionUrl = event.actionUrl;
  if (actionUrl && !actionUrl.includes("\\")) {
    if (actionUrl.startsWith("/") && !actionUrl.startsWith("//")) {
      if (origin) {
        try {
          const base = new URL(origin);
          const url = new URL(actionUrl, base);
          if (url.protocol === "https:" && url.origin === base.origin) destination = url.href;
        } catch { /* A missing/invalid public origin must not produce an unsafe link. */ }
      }
    } else {
      try {
        const url = new URL(actionUrl);
        if (url.protocol === "https:" && !url.username && !url.password && hostAllowed(url.hostname.toLowerCase(), allowedHosts)) {
          destination = url.href;
          external = true;
        }
      } catch { /* Not a URL at all: nothing to link. */ }
    }
  }
  return {
    html: `<p>${escapeHtml(event.body)}</p>${destination ? `<p><a href="${escapeHtml(destination)}">${external ? "Buka hadiahmu" : "Buka Arena"}</a></p>` : ""}`,
    text: event.body + (destination ? `\n\n${destination}` : ""),
  };
}
