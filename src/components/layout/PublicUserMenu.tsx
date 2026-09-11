'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { LogoutForm } from '@/components/auth/LogoutForm';

export interface PublicNavUser {
  displayName: string | null;
  email: string | null;
  avatarId: string | null;
}

/**
 * Who you are, on the pages that do not require you to be anyone.
 *
 * The public navbar used to show "Masuk" to everybody, including participants
 * who were already signed in — the session is shared across the domain, so
 * arriving here from the main site already signed in and being asked to sign in
 * again is the exact confusion this removes.
 *
 * Deliberately lighter than the app navbar's menu: no notification polling on a
 * marketing page. Just identity, the way in, and the way out.
 */
export function PublicUserMenu({ user }: { user: PublicNavUser }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = user.displayName ?? 'Peserta';

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu pengguna, ${name}`}
        className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
      >
        {/* The initial stands in only until they have picked an avatar; the
            picker runs on their first arrival inside /app. */}
        {user.avatarId ? (
          <AvatarBadge avatarId={user.avatarId} size="sm" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sk-blue to-sk-blue-400 text-[13px] font-bold text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate text-[13px] font-semibold text-sk-navy sm:inline">{name}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu pengguna"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-1.5 shadow-sk-lg"
        >
          <div className="px-3 py-2">
            <p className="text-[13px] font-bold text-sk-navy">{name}</p>
            {user.email ? <p className="break-all font-mono text-[10.5px] text-sk-muted">{user.email}</p> : null}
          </div>
          <div className="my-1 h-px bg-sk-border" />
          <Link
            href="/app/profile"
            role="menuitem"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-sk-body transition-colors hover:bg-sk-bg"
          >
            <UserRound size={15} aria-hidden /> Profil
          </Link>
          <LogoutForm>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-sk-error transition-colors hover:bg-sk-error-wash"
            >
              <LogOut size={15} aria-hidden /> Keluar
            </button>
          </LogoutForm>
        </div>
      )}
    </div>
  );
}
