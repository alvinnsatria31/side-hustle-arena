/**
 * Outbound events to the n8n automation box on the VPS — full port of the
 * website's `arena-webhooks.ts` direction (app → n8n).
 *
 * Delivery is best-effort BY DESIGN: n8n runs on a single VPS, and a
 * participant must still be able to submit while that box is rebooting.
 * Every failure is logged and swallowed; the Arena database stays the source
 * of truth and n8n only ever reacts. Pure module (no server-only import) so
 * the skip-without-token path is offline-testable.
 */

export type VpsWebhookEvent = "quest-create" | "arena-submit" | "arena-publish";

const TIMEOUT_MS = 8000;

export interface VpsDeliveryResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
}

function baseUrl(): string {
  const configured = process.env.VPS_WEBHOOK_BASE_URL;
  return (configured ?? "http://202.74.75.95/webhook").replace(/\/+$/, "");
}

/** Send one event, awaiting the result. Prefer notifyVps (fire-and-forget) at call sites. */
export async function sendVpsWebhook(
  event: VpsWebhookEvent,
  payload: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<VpsDeliveryResult> {
  const token = process.env.VPS_WEBHOOK_TOKEN;
  if (!token) {
    // Not an error in development: the VPS is usually unreachable anyway.
    // Logged, never thrown — the Arena stays fully usable without automation.
    console.warn(`[vps-webhook] VPS_WEBHOOK_TOKEN is not set — skipped "${event}".`);
    return { ok: false, skipped: true, error: "Webhook token not configured" };
  }
  try {
    const response = await fetcher(`${baseUrl()}/${event}`, {
      method: "POST",
      headers: { "X-Arena-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ event, sent_at: new Date().toISOString(), ...payload }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[vps-webhook] ${event} rejected (${response.status}).`);
      return { ok: false, status: response.status };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    console.error(`[vps-webhook] ${event} failed to deliver:`, error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/** Fire-and-forget: never blocks, never throws. Use this at every call site. */
export function notifyVps(event: VpsWebhookEvent, payload: Record<string, unknown>): void {
  void sendVpsWebhook(event, payload).catch(() => undefined);
}
