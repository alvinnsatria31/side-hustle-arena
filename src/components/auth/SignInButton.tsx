'use client';

import { Button } from '@/components/primitives/Button';
import { useSignIn } from '@/features/auth/sign-in';

/**
 * The sign-in control for a full page (the modal has its own copy of this).
 *
 * A button rather than a link, because the gate opens in a popup: the page
 * behind it stays put and reloads only once a session exists.
 */
export function SignInButton({
  continueTo,
  size = 'lg',
  fullWidth = true,
  label = 'Masuk dengan akun Sekolah Karir',
}: {
  continueTo?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  label?: string;
}) {
  const { signIn, pending, message } = useSignIn(continueTo);

  return (
    <>
      {message ? (
        <p role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash px-4 py-3 text-[12.5px] leading-relaxed text-sk-error">
          {message}
        </p>
      ) : null}
      <Button size={size} fullWidth={fullWidth} onClick={() => void signIn()} loading={pending} disabled={pending}>
        {pending ? 'Menunggu jendela masuk…' : label}
      </Button>
    </>
  );
}
