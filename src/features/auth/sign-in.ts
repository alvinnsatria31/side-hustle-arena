'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { signInWithPopup, signInWithRedirect } from '@/lib/sign-in-popup';
import { sanitizeInternalReturnPath } from '@/server/auth/return-path';

export type SignInStatus = 'idle' | 'pending' | 'cancelled' | 'unavailable';

const MESSAGES: Record<Exclude<SignInStatus, 'idle' | 'pending'>, string> = {
  cancelled: 'Jendela masuk ditutup sebelum selesai. Coba lagi kalau sudah siap.',
  unavailable: 'Masuk sedang bermasalah di sisi kami. Coba lagi beberapa saat lagi.',
};

/**
 * Drive the sign-in popup from a component.
 *
 * On success this reloads the document rather than routing: the session lives in
 * a cookie that only the server reads, so every server component on the target
 * page — the protected layout, the identity it hands to the navbar, the avatar
 * picker it raises for a first-time participant — has to be rendered again with
 * the cookie attached. A client-side navigation would arrive at `/app` still
 * believing nobody is signed in.
 */
export function useSignIn(continueTo?: string) {
  const [status, setStatus] = useState<SignInStatus>('idle');
  const controller = useRef<AbortController | null>(null);

  // Stop polling if the component goes away mid-flow. The popup stays open on
  // purpose — someone halfway through an OTP should not lose the window because
  // the page behind it re-rendered.
  useEffect(() => () => controller.current?.abort(), []);

  const signIn = useCallback(async () => {
    if (status === 'pending') return;
    setStatus('pending');
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;

    const outcome = await signInWithPopup(current.signal);
    if (current.signal.aborted) return;

    if (outcome === 'blocked') {
      // Nothing to poll if the window never opened. Hand over the whole tab —
      // less pleasant than the popup, but it always works.
      signInWithRedirect();
      return;
    }
    if (outcome === 'signed-in') {
      window.location.assign(sanitizeInternalReturnPath(continueTo));
      return;
    }
    setStatus(outcome);
  }, [status, continueTo]);

  return {
    status,
    signIn,
    pending: status === 'pending',
    message: status === 'cancelled' || status === 'unavailable' ? MESSAGES[status] : '',
  };
}
