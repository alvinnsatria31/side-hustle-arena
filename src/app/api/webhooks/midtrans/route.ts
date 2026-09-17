import { handleMidtransNotification } from "@/server/store/payment-service";

export const dynamic = "force-dynamic";

/**
 * Midtrans payment notifications.
 *
 * Deliberately not behind `requireStoreEnabled()`. Turning the shop off must not
 * strand money already in flight: a payment made a minute before the flag flips
 * still has to be settled, and a notification we refuse is one Midtrans retries
 * until it gives up and our records disagree with theirs permanently.
 *
 * Authentication is the signature on the body, checked in the service — there is
 * no session here and no bearer token, because the caller is Midtrans.
 *
 * The status codes are chosen for how Midtrans reads them, not for tidiness:
 *   200 — understood, whether or not it changed anything. Duplicates and
 *         notifications about orders we do not recognise are 200 on purpose;
 *         retrying either would never produce a different outcome.
 *   401 — the signature did not verify. Genuinely not from Midtrans.
 *   400 — the body was not a notification at all.
 *   500 — our fault, and the one case where a retry is worth something.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "MALFORMED" }, { status: 400 });
  }

  try {
    const result = await handleMidtransNotification(body);
    if (!result.handled) {
      return Response.json({ ok: false, reason: result.reason }, { status: result.reason === "BAD_SIGNATURE" ? 401 : 400 });
    }
    return Response.json({ ok: true, outcome: result.outcome }, { status: 200 });
  } catch (error) {
    // Never echo the failure back: the body is attacker-influenced even after a
    // valid signature, and Midtrans only needs to know whether to try again.
    console.error("[store] Midtrans notification failed:", error);
    return Response.json({ ok: false, reason: "INTERNAL_ERROR" }, { status: 500 });
  }
}
