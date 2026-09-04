/**
 * Outbound email through Resend — port of the website's email philosophy:
 * the Arena carries its own key (never routed through the main site, which
 * would put www back in the failure path), on the shared verified domain.
 *
 * Failure semantics: a failed send costs a resend, never a reward. The
 * redemption/ledger rows exist either way. Pure module (fetch injected) so
 * the no-key skip path is offline-testable.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailResult =
  | { ok: true; skipped?: false; id?: string }
  | { ok: true; skipped: true }
  | { ok: false; error: string };

export async function sendArenaEmail(
  message: EmailMessage,
  options: { apiKey?: string; from?: string; fetcher?: typeof fetch } = {},
): Promise<EmailResult> {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Distinct from failure: nothing was sent and must never be recorded as sent.
    console.warn("[email] RESEND_API_KEY is not set — email skipped.");
    return { ok: true, skipped: true };
  }
  try {
    const response = await (options.fetcher ?? fetch)(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: options.from ?? process.env.ARENA_FROM_EMAIL ?? "Side-Hustle Arena <noreply@sekolahkarir.id>",
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { ok: false, error: `Resend HTTP ${response.status}` };
    }
    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: payload?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
