'use client';

import type { ReactNode } from 'react';
import { useDemo } from '@/features/demo/store';
import { clearLocalAccountData } from '@/features/demo/state';

/**
 * Sign-out form. The server clears the shared session cookie; what this browser
 * kept about the person — the last CV analysis above all — is cleared here,
 * synchronously, before the POST navigates away from the Arena.
 */
export function LogoutForm({ children, className }: { children: ReactNode; className?: string }) {
  const { logout } = useDemo();
  return (
    <form
      action="/auth/logout"
      method="post"
      className={className}
      onSubmit={() => {
        logout();
        clearLocalAccountData();
      }}
    >
      {children}
    </form>
  );
}
