'use client';

/**
 * Signing in without leaving the Arena.
 *
 * The Arena cannot authenticate anyone itself — it verifies the Sekolah Karir
 * participant cookie and issues nothing (docs/backend/PARTICIPANT_SESSION.md).
 * So "log in here" means running the main site's gate in a popup window instead
 * of navigating the whole tab to it: the page underneath keeps its scroll, its
 * open project, and its unsaved state, and the participant comes back to
 * exactly what they were looking at.
 *
 * How we learn it worked: polling `/api/auth/session`, not a message from the
 * popup. The gate is a different origin, so we can read nothing from that window
 * beyond `closed` — but the cookie it sets is scoped to the registrable domain,
 * so our own origin can simply look. That means no contract to agree with the
 * other repo and nothing to break when the gate changes where it redirects.
 */

export type SignInOutcome =
  /** The participant cookie is now present and valid. */
  | 'signed-in'
  /** The popup was closed (or timed out) without a session appearing. */
  | 'cancelled'
  /** The browser refused the popup; the caller should navigate instead. */
  | 'blocked'
  /** Sign-in is misconfigured on the server; polling would never terminate. */
  | 'unavailable';

const POPUP_NAME = 'sk-sign-in';
const POLL_INTERVAL_MS = 1200;
/** Long enough for an OTP email to arrive and be typed; short enough to end. */
const TIMEOUT_MS = 5 * 60 * 1000;

/** The Arena route that redirects to the gate, so the gate's origin stays server-side. */
export const SIGN_IN_PATH = '/auth/login';

function popupFeatures(): string {
  const width = 480;
  const height = 700;
  // Centre on the window the participant is actually looking at, which on a
  // multi-monitor setup is not the same thing as centring on the screen.
  const left = Math.max(0, (window.screenX ?? 0) + ((window.outerWidth || width) - width) / 2);
  const top = Math.max(0, (window.screenY ?? 0) + ((window.outerHeight || height) - height) / 3);
  // No `noopener` here, in any form. Browsers decide it on the feature's mere
  // presence rather than its value, and a noopener window comes back as null —
  // which this module reads as "popup blocked" and answers with a full-tab
  // redirect, quietly losing the whole point of the popup.
  return `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`;
}

async function isSignedIn(): Promise<boolean | 'unavailable'> {
  try {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 503 || response.status === 500) return 'unavailable';
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return payload?.data?.signedIn === true;
  } catch {
    // A dropped request mid-poll is not an answer. Keep waiting; the timeout is
    // what ends this, not one failed fetch.
    return false;
  }
}

/**
 * Open the gate and resolve once the session exists.
 *
 * `signal` lets a component that unmounts stop polling; it does not close the
 * popup, because a participant halfway through typing an OTP should not have
 * the window yanked away by a re-render.
 */
export function signInWithPopup(signal?: AbortSignal): Promise<SignInOutcome> {
  const popup = window.open(SIGN_IN_PATH, POPUP_NAME, popupFeatures());
  if (!popup) return Promise.resolve('blocked');
  popup.focus?.();

  return new Promise<SignInOutcome>((resolve) => {
    const startedAt = Date.now();
    let finished = false;
    let timer = 0;

    const finish = (outcome: SignInOutcome) => {
      if (finished) return;
      finished = true;
      window.clearInterval(timer);
      signal?.removeEventListener('abort', onAbort);
      // Only our own success closes the window. A cancelled or timed-out flow
      // leaves it alone: the participant may still be reading it.
      if (outcome === 'signed-in') {
        try { popup.close(); } catch { /* cross-origin close can throw; harmless */ }
      }
      resolve(outcome);
    };

    const onAbort = () => finish('cancelled');
    signal?.addEventListener('abort', onAbort);

    let checking = false;
    const tick = async () => {
      if (checking || finished) return;
      checking = true;
      try {
        const state = await isSignedIn();
        if (state === 'unavailable') return finish('unavailable');
        if (state) return finish('signed-in');

        // `closed` is one of the few things readable on a cross-origin window.
        // Check it after the session probe, never before: a participant who
        // signs in and immediately closes the popup is signed in, and treating
        // that as a cancellation would drop a session we already hold.
        if (popup.closed) return finish('cancelled');
        if (Date.now() - startedAt > TIMEOUT_MS) return finish('cancelled');
      } finally {
        checking = false;
      }
    };

    timer = window.setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
  });
}

/** Fallback when the browser blocks popups: hand the whole tab to the gate. */
export function signInWithRedirect(): void {
  // A full document navigation, not router.push: /auth/login redirects to
  // another origin, which a client-side navigation cannot follow.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(SIGN_IN_PATH);
}
